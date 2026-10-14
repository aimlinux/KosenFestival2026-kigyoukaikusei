import json
import os
import re
import sqlite3
import uuid
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
LOCAL_DATA_DIR = os.environ.get("LOCALAPPDATA")
DATA_DIR = (
    Path(LOCAL_DATA_DIR) / "KosenFestival2026"
    if LOCAL_DATA_DIR
    else Path.home() / ".local" / "share" / "KosenFestival2026"
)
DATABASE_PATH = DATA_DIR / "hobby-ranking.sqlite3"
MAX_REQUEST_BYTES = 1024 * 1024
MAX_PROFILES = 1000
MAX_HOBBIES_PER_PROFILE = 6
MAX_HOBBY_LENGTH = 30
CLIENT_COOKIE = "kosen_festival_client"


def initialize_database(database_path):
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS profile_hobbies (
                client_id TEXT NOT NULL,
                profile_id TEXT NOT NULL,
                hobby_key TEXT NOT NULL,
                hobby TEXT NOT NULL,
                PRIMARY KEY (client_id, profile_id, hobby_key)
            )
            """
        )


def validate_profiles(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("profiles"), list):
        raise ValueError("profiles must be an array")
    profiles = payload["profiles"]
    if len(profiles) > MAX_PROFILES:
        raise ValueError("too many profiles")

    validated = []
    seen_ids = set()
    for profile in profiles:
        if not isinstance(profile, dict):
            raise ValueError("each profile must be an object")
        profile_id = profile.get("id")
        hobbies = profile.get("hobbies")
        if not isinstance(profile_id, str) or not profile_id or len(profile_id) > 128:
            raise ValueError("each profile must have a valid id")
        if profile_id in seen_ids:
            raise ValueError("profile ids must be unique")
        if not isinstance(hobbies, list) or len(hobbies) > MAX_HOBBIES_PER_PROFILE:
            raise ValueError("each profile must have up to six hobbies")
        seen_ids.add(profile_id)

        unique_hobbies = {}
        for hobby in hobbies:
            if not isinstance(hobby, str):
                raise ValueError("hobbies must be strings")
            name = " ".join(hobby.split())
            if len(name) > MAX_HOBBY_LENGTH:
                raise ValueError("hobby is too long")
            if name:
                unique_hobbies.setdefault(name.casefold(), name)
        validated.append((profile_id, list(unique_hobbies.items())))
    return validated


def replace_client_profiles(database_path, client_id, profiles):
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "DELETE FROM profile_hobbies WHERE client_id = ?",
            (client_id,),
        )
        for profile_id, hobbies in profiles:
            connection.executemany(
                """
                INSERT INTO profile_hobbies (client_id, profile_id, hobby_key, hobby)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (client_id, profile_id, hobby_key, hobby)
                    for hobby_key, hobby in hobbies
                ],
            )


def get_hobby_ranking(database_path):
    with sqlite3.connect(database_path) as connection:
        rows = connection.execute(
            """
            SELECT hobby_key, MIN(hobby), COUNT(*)
            FROM profile_hobbies
            GROUP BY hobby_key
            """
        ).fetchall()

    entries = [
        {"name": name, "count": count}
        for _, name, count in rows
    ]
    entries.sort(key=lambda entry: (-entry["count"], entry["name"].casefold(), entry["name"]))
    return entries[:5]


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, database_path=DATABASE_PATH, **kwargs):
        self.database_path = Path(database_path)
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/hobbies/ranking":
            self.send_json({"ranking": get_hobby_ranking(self.database_path)})
            return
        if path.startswith("/api/"):
            self.send_json({"error": "Not found"}, status=404)
            return
        super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path != "/api/hobbies/sync":
            self.send_json({"error": "Not found"}, status=404)
            return

        content_length = self.headers.get("Content-Length")
        if content_length is None or not content_length.isdecimal():
            self.send_json({"error": "A valid Content-Length is required"}, status=411)
            return
        if len(content_length) > 10 or int(content_length) > MAX_REQUEST_BYTES:
            self.send_json({"error": "Request body is too large"}, status=413)
            return

        try:
            payload = json.loads(self.rfile.read(int(content_length)).decode("utf-8"))
            profiles = validate_profiles(payload)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self.send_json({"error": str(error)}, status=400)
            return

        client_id, set_cookie = self.get_client_id()
        replace_client_profiles(self.database_path, client_id, profiles)
        self.send_json(
            {"ranking": get_hobby_ranking(self.database_path)},
            set_cookie=set_cookie,
        )

    def get_client_id(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except CookieError:
            cookie = SimpleCookie()

        morsel = cookie.get(CLIENT_COOKIE)
        client_id = morsel.value if morsel else ""
        if re.fullmatch(r"[a-f0-9]{32}", client_id):
            return client_id, None

        client_id = uuid.uuid4().hex
        return client_id, (
            f"{CLIENT_COOKIE}={client_id}; Path=/; "
            "HttpOnly; SameSite=Lax; Max-Age=315360000"
        )

    def send_json(self, payload, status=200, set_cookie=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
        self.end_headers()
        self.wfile.write(body)


def run_server(host="0.0.0.0", port=8000, database_path=DATABASE_PATH):
    initialize_database(database_path)
    server = ThreadingHTTPServer(
        (host, port),
        lambda *args, **kwargs: AppHandler(
            *args,
            database_path=database_path,
            **kwargs,
        ),
    )
    print(f"文化祭参加者カードを http://localhost:{port} で起動しました")
    print(f"趣味ランキングの保存先: {database_path}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
