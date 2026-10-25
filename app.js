// DOM要素を簡単に取得するためのショートカット

// DOMとは
// Document Object Model（ドキュメント・オブジェクト・モデル）の略で、
// HTMLやXMLの文書をJavaScriptなどのプログラムから操作・変更できるようにする仕組み
const $ = (id) => document.getElementById(id);

// 画面上のフォーム・プレビュー・一覧などの要素をまとめて管理
const els = {
  form: $("profileForm"),
  name: $("name"),
  className: $("className"),
  nickname: $("nickname"),
  talent: $("talent"),
  theme: $("theme"),
  orientation: $("orientation"),
  printScale: $("printScale"),
  printScaleValue: $("printScaleValue"),
  hobbyInputs: $("hobbyInputs"),
  hobbyCount: $("hobbyCount"),
  addHobbyBtn: $("addHobbyBtn"),
  hobbyRankingList: $("hobbyRankingList"),
  saveBtn: $("saveBtn"),
  newBtn: $("newBtn"),
  printBtn: $("printBtn"),
  pngBtn: $("pngBtn"),
  savedList: $("savedList"),
  clearAllBtn: $("clearAllBtn"),
  status: $("status"),
  previewStage: $("previewStage"),
  card: $("card"),
  previewClass: $("previewClass"),
  previewName: $("previewName"),
  previewNickname: $("previewNickname"),
  previewHobbies: $("previewHobbies"),
  previewTalent: $("previewTalent"),
  toast: $("toast"),
  printPreviewModal: $("printPreviewModal"),
  printPreviewImage: $("printPreviewImage"),
  printPreviewTitle: $("printPreviewTitle"),
  printPreviewClose: $("printPreviewClose"),
  printPreviewAction: $("printPreviewAction"),
  profileCount: $("profileCount"),
  profileSearch: $("profileSearch"),
  profileSort: $("profileSort"),
  selectAllProfiles: $("selectAllProfiles"),
  selectedCount: $("selectedCount"),
  bulkDeleteBtn: $("bulkDeleteBtn"),
  exportCsvBtn: $("exportCsvBtn")
};

// 現在編集中のプロフィールIDと趣味入力の一時状態
let currentId = null;
let hobbyValues = [];
let hobbyRanking = [];
let hobbyRankingIsSample = false;
let hobbyRankingMessage = "ランキングを読み込み中です";
let hobbyRankingQueue = Promise.resolve();
const SAMPLE_HOBBY_RANKING = [
  { name: "ゲーム", count: 12 },
  { name: "音楽", count: 10 },
  { name: "映画・アニメ", count: 8 },
  { name: "読書", count: 6 },
  { name: "スポーツ", count: 5 }
];
const MAX_HOBBIES = 12;

// ローカルストレージの保存先キー
const STORAGE_KEY = "person-card-studio-profiles-v1";

// トースト通知を表示して一定時間後に非表示にする
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function normalizeText(value) {
  // 入力欄の前後にある余分な空白を取り除き、保存する文字列を統一する。
  return value.trim();
}

function renderHobbies(values = hobbyValues) {
  // 趣味の入力欄は固定で用意せず、配列の内容から必要な数だけ作り直す。
  // 表示・保存・出力で扱える数を12件に揃える。
  hobbyValues = values.slice(0, MAX_HOBBIES);
  els.hobbyInputs.innerHTML = "";

  hobbyValues.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "hobby-row";

    const input = document.createElement("input");
    input.maxLength = 30;
    input.placeholder = `趣味 ${index + 1}`;
    input.value = value;
    input.addEventListener("input", () => {
      // 入力欄の番号に対応する配列の値を更新し、プレビューもすぐに反映する。
      hobbyValues[index] = input.value;
      updatePreview();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-hobby";
    remove.textContent = "×";
    remove.title = "削除";
    remove.addEventListener("click", () => {
      // 配列から対象の趣味を削除して、入力欄を現在の配列内容で再生成する。
      hobbyValues.splice(index, 1);
      renderHobbies();
      updatePreview();
    });

    row.append(input, remove);
    els.hobbyInputs.appendChild(row);
  });

  els.hobbyCount.textContent = `${hobbyValues.length} / ${MAX_HOBBIES}`;
  els.addHobbyBtn.disabled = hobbyValues.length >= MAX_HOBBIES;
}

function renderHobbyRanking() {
  els.hobbyRankingList.replaceChildren();
  if (hobbyRanking.length === 0) {
    const empty = document.createElement("li");
    empty.className = "hobby-ranking-empty";
    empty.textContent = hobbyRankingMessage;
    els.hobbyRankingList.appendChild(empty);
    return;
  }

  hobbyRanking.forEach(({ name, count }, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hobby-ranking-item";
    button.setAttribute("aria-label", `${name}、${count}人`);

    const position = document.createElement("span");
    position.className = "hobby-ranking-position";
    position.textContent = `${index + 1}`;

    const hobbyName = document.createElement("span");
    hobbyName.className = "hobby-ranking-name";
    hobbyName.textContent = name;

    const popularity = document.createElement("span");
    popularity.className = "hobby-ranking-count";
    popularity.textContent = `${count}人`;

    button.append(position, hobbyName, popularity);
    button.addEventListener("click", () => addRankedHobby(name));
    item.appendChild(button);
    els.hobbyRankingList.appendChild(item);
  });

  if (hobbyRankingIsSample) {
    const note = document.createElement("li");
    note.className = "hobby-ranking-empty";
    note.textContent = hobbyRankingMessage;
    els.hobbyRankingList.appendChild(note);
  }
}

function queueHobbyRankingRequest(request) {
  hobbyRankingQueue = hobbyRankingQueue.then(async () => {
    const response = await request();
    if (!response.ok) {
      throw new Error(`ランキングサーバーがHTTP ${response.status}を返しました`);
    }

    const result = await response.json();
    if (!Array.isArray(result.ranking)) {
      throw new Error("ランキングサーバーから不正な応答が返されました");
    }

    hobbyRanking = result.ranking.filter(entry =>
      entry &&
      typeof entry.name === "string" &&
      Number.isInteger(entry.count) &&
      entry.count > 0
    );
    hobbyRankingIsSample = false;
    hobbyRankingMessage = hobbyRanking.length
      ? "サーバーに保存されたランキングです"
      : "サーバーに趣味の登録はまだありません";
    renderHobbyRanking();
  }).catch(error => {
    const wasUsingSample = hobbyRankingIsSample;
    hobbyRanking = SAMPLE_HOBBY_RANKING;
    hobbyRankingIsSample = true;
    hobbyRankingMessage = "サーバー未接続時の仮データです。実際のランキングはサーバー起動後に表示されます。";
    renderHobbyRanking();
    if (!wasUsingSample) {
      console.warn("趣味ランキングサーバーに接続できないため、仮データを表示します:", error);
    }
  });

  return hobbyRankingQueue;
}

function syncHobbyRanking() {
  const profiles = loadProfiles().map(profile => ({
    id: profile.id,
    hobbies: Array.isArray(profile.hobbies) ? profile.hobbies : []
  }));

  return queueHobbyRankingRequest(() => fetch("/api/hobbies/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profiles })
  }));
}

function refreshHobbyRanking() {
  return queueHobbyRankingRequest(() => fetch("/api/hobbies/ranking"));
}

function addRankedHobby(name) {
  const existingIndex = hobbyValues.findIndex(
    value => normalizeText(value).toLocaleLowerCase("ja") === name.toLocaleLowerCase("ja")
  );
  if (existingIndex >= 0) {
    els.hobbyInputs.querySelectorAll("input")[existingIndex]?.focus();
    return;
  }

  let targetIndex = hobbyValues.findIndex(value => !normalizeText(value));
  if (targetIndex < 0) {
    if (hobbyValues.length >= MAX_HOBBIES) {
      showToast(`趣味は最大${MAX_HOBBIES}個までです`);
      return;
    }
    hobbyValues.push(name);
    targetIndex = hobbyValues.length - 1;
  } else {
    hobbyValues[targetIndex] = name;
  }

  renderHobbies();
  updatePreview();
  els.hobbyInputs.querySelectorAll("input")[targetIndex]?.focus();
}

// フォームの入力内容をプロフィールオブジェクトに変換する
function getProfileFromForm() {
  // フォームと一時保存中の趣味を、保存・表示で扱いやすい1つのオブジェクトにまとめる。
  // 空の趣味は保存せず、未入力の名前などにはプレビュー用の初期値を設定する。
  const hobbies = hobbyValues.map(normalizeText).filter(Boolean);
  return {
    id: currentId || crypto.randomUUID(),
    name: normalizeText(els.name.value) || "名前未入力",
    className: normalizeText(els.className.value) || "CLASS",
    nickname: normalizeText(els.nickname.value),
    hobbies,
    talent: normalizeText(els.talent.value),
    theme: els.theme.value,
    orientation: els.orientation.value,
    printScale: Number(els.printScale.value),
    updatedAt: new Date().toISOString()
  };
}

// 入力内容をリアルタイムでカードプレビューへ反映する
function updatePreview() {
  // 入力中のフォームを読み取り、カードの文字・テーマ・向きを一度に更新する。
  // 保存前でも呼び出されるため、編集状態か新規作成状態かもここで表示する。
  const profile = getProfileFromForm();

  els.previewClass.textContent = profile.className;
  els.previewName.textContent = profile.name;
  els.previewNickname.textContent = profile.nickname ? profile.nickname : "nickname";
  els.previewHobbies.textContent = `趣味：${profile.hobbies.join("・") || "未入力"}`;
  els.previewTalent.textContent = profile.talent || "特技を入力";
  els.printScaleValue.value = `${profile.printScale}%`;
  els.printScaleValue.textContent = `${profile.printScale}%`;
  els.previewStage.style.setProperty("--print-scale", String(profile.printScale / 100));

  els.card.classList.remove("theme-purple", "theme-blue", "theme-green");
  els.card.classList.add(`theme-${profile.theme}`);

  els.previewStage.classList.toggle("portrait", profile.orientation === "portrait");
  els.previewStage.classList.toggle("landscape", profile.orientation !== "portrait");

  els.status.textContent = currentId ? "編集モード" : "未保存";
}

// フォームを初期状態に戻して新規作成モードへ切り替える
function resetForm() {
  // 新規作成ボタンや全削除後に呼び出し、編集中のIDとフォームを初期状態に戻す。
  // サンプル値を入れて、画面を開いた直後でもカードの見た目を確認できるようにする。
  currentId = null;
  els.form.reset();
  els.name.value = "小原和真";
  els.className.value = "5J";
  els.nickname.value = "jr（ジュニア）";
  els.talent.value = "指パッチン";
  hobbyValues = ["ギター", "魚釣り", "ゲーム", "映画"]; 
  renderHobbies();
  els.theme.value = "blue";
  els.orientation.value = "landscape";
  els.printScale.value = "100";
  updatePreview();
}

// 保存済みプロフィールをローカルストレージから読み込む
function loadProfiles() {
  // localStorageには文字列として保存されているため、JSONをプロフィール配列に戻す。
  // 壊れたデータが残っていても画面全体が停止しないよう、読み込み失敗時は空配列を返す。
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

// プロフィール一覧をローカルストレージに保存する
function saveProfiles(profiles) {
  // プロフィール本体はブラウザー内に保存し、趣味だけをランキング用サーバーへ同期する。
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  syncHobbyRanking();
}

function saveCurrent() {
  // 名前が空の場合は保存せず、入力欄へフォーカスして修正箇所を知らせる。
  if (!normalizeText(els.name.value)) {
    els.name.focus();
    showToast("名前を入力してください");
    return;
  }

  const profile = getProfileFromForm();
  const profiles = loadProfiles();
  // currentIdが一致すれば既存プロフィールの更新、一致しなければ新しいプロフィールとして先頭に追加する。
  const index = profiles.findIndex(p => p.id === profile.id);

  if (index >= 0) profiles[index] = profile;
  else profiles.unshift(profile);

  currentId = profile.id;
  saveProfiles(profiles);
  renderSavedList();
  updatePreview();
  showToast(index >= 0 ? "プロフィールを更新しました" : "プロフィールを保存しました");
}

function loadProfile(id) {
  // 一覧で選ばれたIDのプロフィールを探し、各項目をフォームへ戻して編集状態にする。
  // 対応するデータが見つからない場合は、画面を変更せずに終了する。
  const profile = loadProfiles().find(p => p.id === id);
  if (!profile) return;

  currentId = profile.id;
  els.name.value = profile.name || "";
  els.className.value = profile.className || "";
  els.nickname.value = profile.nickname || "";
  els.talent.value = profile.talent || "";
  els.theme.value = profile.theme === "cafe" ? "blue" : profile.theme || "blue";
  els.orientation.value = profile.orientation || "landscape";
  els.printScale.value = String(profile.printScale || 100);
  renderHobbies(profile.hobbies || []);
  updatePreview();
  showToast("プロフィールを読み込みました");
}

function deleteProfile(id) {
  // 指定IDだけを除いた配列を保存し、現在編集中のデータならフォームも新規状態に戻す。
  const profiles = loadProfiles().filter(p => p.id !== id);
  saveProfiles(profiles);
  if (currentId === id) resetForm();
  renderSavedList();
  showToast("削除しました");
}

function renderSavedList() {
  // 保存データを検索・並び替えした結果から、プロフィール一覧のDOMを毎回作り直す。
  // 再描画前に選択済みIDを取得することで、検索や並び替え後も選択状態を維持する。
  let profiles = loadProfiles();

  // =========================
  // 検索
  // =========================

  const search = els.profileSearch.value
    .trim()
    .toLowerCase();

  if (search) {

    profiles = profiles.filter(profile => {
      // 名前だけでなく、クラス・ニックネーム・趣味・特技・タグをまとめて検索対象にする。
      const text = [
        profile.name,
        profile.className,
        profile.nickname,
        ...(profile.hobbies || []),
        profile.talent
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }


  // =========================
  // 並び替え
  // =========================

  const sortType = els.profileSort.value;

  profiles.sort((a, b) => {
    // 選択された並び順に応じて比較値を返す。日本語名・クラス名は日本語ロケールで比較する。
    if (sortType === "name-asc") {

      return a.name.localeCompare(
        b.name,
        "ja"
      );

    }

    if (sortType === "class-asc") {

      return a.className.localeCompare(
        b.className,
        "ja"
      );

    }

    // 更新順
    return new Date(b.updatedAt) -
           new Date(a.updatedAt);
  });


  // =========================
  // 人数表示
  // =========================

  const allProfiles = loadProfiles();

  els.profileCount.textContent =
    `${allProfiles.length}人`;


  // =========================
  // 一覧をクリア
  // =========================

  els.savedList.innerHTML = "";


  // =========================
  // データがない場合
  // =========================

  if (!profiles.length) {

    const empty = document.createElement("div");

    empty.className = "empty";

    empty.textContent =
      search
        ? "検索結果がありません"
        : "まだ保存されていません";

    els.savedList.appendChild(empty);

    updateSelectionUI();

    return;
  }


  // =========================
  // 選択状態を保持
  // =========================

  const selectedIds =
    new Set(getSelectedIds());


  // =========================
  // 人物カードを生成
  // =========================

  profiles.forEach(profile => {

    const item =
      document.createElement("div");

    item.className =
      "saved-item";


    // -------------------------
    // チェックボックス
    // -------------------------

    const checkWrap =
      document.createElement("label");

    checkWrap.className =
      "profile-check-wrap";


    const check =
      document.createElement("input");

    check.type = "checkbox";

    check.className =
      "profile-check";

    check.dataset.id =
      profile.id;

    check.checked =
      selectedIds.has(profile.id);


    check.addEventListener(
      "change",
      updateSelectionUI
    );


    checkWrap.appendChild(check);


    // -------------------------
    // 人物情報
    // -------------------------

    const main =
      document.createElement("div");

    main.className =
      "saved-item-main";


    main.innerHTML = `
      <div class="saved-item-name"></div>

      <div class="saved-item-meta"></div>

    `;


    main.querySelector(
      ".saved-item-name"
    ).textContent =
      profile.name;


    main.querySelector(
      ".saved-item-meta"
    ).textContent =
      `${profile.className || "CLASS"} / ` +
      `${(profile.hobbies || []).length}個の趣味` +
      `${profile.nickname ? " / " + profile.nickname : ""}`;


    // クリックで編集
    main.addEventListener(
      "click",
      () => loadProfile(profile.id)
    );


    // -------------------------
    // 操作ボタン
    // -------------------------

    const buttons =
      document.createElement("div");

    buttons.className =
      "saved-item-buttons";


    // 編集
    const edit =
      document.createElement("button");

    edit.className =
      "saved-action";

    edit.textContent =
      "編集";

    edit.addEventListener(
      "click",
      () => loadProfile(profile.id)
    );


    // 複製
    const duplicate =
      document.createElement("button");

    duplicate.className =
      "saved-action";

    duplicate.textContent =
      "複製";

    duplicate.addEventListener(
      "click",
      () => duplicateProfile(profile.id)
    );


    // 削除
    const del =
      document.createElement("button");

    del.className =
      "saved-action delete";

    del.textContent =
      "削除";

    del.addEventListener(
      "click",
      () => deleteProfile(profile.id)
    );


    buttons.append(
      edit,
      duplicate,
      del
    );


    // -------------------------
    // 1人分を一覧に追加
    // -------------------------

    item.append(
      checkWrap,
      main,
      buttons
    );

    els.savedList.appendChild(item);

  });


  updateSelectionUI();
}

function getSelectedIds() {
  // 現在一覧に表示されているチェック済みチェックボックスから、プロフィールIDだけを取り出す。
  return Array.from(
    document.querySelectorAll(
      ".profile-check:checked"
    )
  ).map(
    checkbox => checkbox.dataset.id
  );

}

function updateSelectionUI() {
  // 選択人数、複数削除ボタン、全選択チェックボックスを現在の選択状態に合わせて更新する。
  const selectedIds =
    getSelectedIds();

  const count =
    selectedIds.length;


  els.selectedCount.textContent =
    `${count}人選択中`;


  els.bulkDeleteBtn.disabled =
    count === 0;


  const checkboxes =
    document.querySelectorAll(
      ".profile-check"
    );


  const allChecked =
    checkboxes.length > 0 &&
    Array.from(checkboxes)
      .every(
        checkbox => checkbox.checked
      );


  els.selectAllProfiles.checked =
    allChecked;

}

function duplicateProfile(id) {
  // 元データを残したまま、新しいIDを付けた複製を作成する。
  // 趣味配列もコピーして、複製後の編集が元プロフィールに影響しないようにする。
  const profiles =
    loadProfiles();


  const source =
    profiles.find(
      profile => profile.id === id
    );


  if (!source) {
    return;
  }


  const copy = {

    ...source,

    id: crypto.randomUUID(),

    name:
      `${source.name}（コピー）`,

    hobbies:
      [...(source.hobbies || [])],

    updatedAt:
      new Date().toISOString()

  };

  profiles.unshift(copy);

  saveProfiles(profiles);

  currentId =
    copy.id;

  renderSavedList();

  loadProfile(copy.id);

  showToast(
    "人物データを複製しました"
  );

}

function bulkDeleteSelected() {
  // 一覧でチェックされたプロフィールをまとめて削除する。
  // 誤操作を防ぐため、削除前に確認ダイアログを表示する。
  const ids =
    getSelectedIds();

  if (!ids.length) {
    return;
  }

  const result =
    confirm(
      `${ids.length}人のプロフィールを削除しますか？`
    );

  if (!result) {
    return;
  }

  const idSet =
    new Set(ids);


  const profiles =
    loadProfiles().filter(
      profile =>
        !idSet.has(profile.id)
    );


  saveProfiles(profiles);


  // 現在編集している人物も削除された場合
  if (
    currentId &&
    idSet.has(currentId)
  ) {
    resetForm();
  }


  renderSavedList();


  showToast(
    `${ids.length}人を削除しました`
  );

}

function exportProfilesCsv() {
  // 保存済みプロフィールを表形式のCSVに変換し、ブラウザからダウンロードする。
  const profiles =
    loadProfiles();


  if (!profiles.length) {

    showToast(
      "出力する人物がいません"
    );

    return;
  }


  // CSVで使えない文字を処理
  const escapeCsv =
    // カンマ・改行・ダブルクォートを含む値も1セルとして扱えるよう、全値を引用符で囲む。
    value =>
      `"${String(value ?? "")
        .replace(/"/g, '""')}"`;


  const rows = [
    [
      "名前",
      "クラス",
      "ニックネーム",
      "趣味1",
      "趣味2",
      "趣味3",
      "趣味4",
      "趣味5",
      "趣味6",
      "趣味7",
      "趣味8",
      "趣味9",
      "趣味10",
      "趣味11",
      "趣味12",
      "隠れた特技"
    ]
  ];

  profiles.forEach(profile => {

    const hobbies =
      profile.hobbies || [];

    rows.push([

      profile.name,

      profile.className,

      profile.nickname,

      ...Array.from({ length: MAX_HOBBIES }, (_, index) => hobbies[index] || ""),

      profile.talent

    ]);

  });


  // BOMを付けることでExcelで文字化けしにくくする
  const csv =
    "\uFEFF" +
    rows
      .map(
        row =>
          row
            .map(escapeCsv)
            .join(",")
      )
      .join("\r\n");


  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;

  a.download =
    `人物一覧_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

  a.click();

  URL.revokeObjectURL(url);

  showToast(
    "人物一覧をCSV出力しました"
  );

}

function loadCardBackground() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("バー背景画像を読み込めませんでした"));
    image.src = new URL("assets/bar-interior.png", document.baseURI).href;
  });
}

// プロフィールをA5相当のキャンバスに描画してPNG出力用の画像を生成する
async function drawCardToCanvas(profile, width = 2480, height = 1748) {
  // 画面のプレビューとは別に、印刷品質に近い大きさのCanvasへカードを描画する。
  // portraitの場合は幅と高さを入れ替え、縦向きの画像として出力する。
  const canvas = document.createElement("canvas");
  const portrait = profile.orientation === "portrait";
  canvas.width = portrait ? height : width;
  canvas.height = portrait ? width : height;

  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  const blue = profile.theme === "blue";
  const green = profile.theme === "green";

  const background = await loadCardBackground();
  const backgroundScale = Math.max(w / background.naturalWidth, h / background.naturalHeight);
  const backgroundWidth = background.naturalWidth * backgroundScale;
  const backgroundHeight = background.naturalHeight * backgroundScale;
  ctx.drawImage(
    background,
    (w - backgroundWidth) / 2,
    (h - backgroundHeight) / 2,
    backgroundWidth,
    backgroundHeight
  );
  ctx.fillStyle = "rgba(7, 5, 4, .68)";
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, w * .5, h * .65);
  if (green) {
    grad.addColorStop(0, "rgba(54,75,48,.2)");
    grad.addColorStop(.3, "rgba(24,20,14,.12)");
  } else if (blue) {
    grad.addColorStop(0, "rgba(67,77,59,.2)");
    grad.addColorStop(.3, "rgba(24,20,14,.12)");
  } else {
    grad.addColorStop(0, "rgba(83,49,58,.2)");
    grad.addColorStop(.3, "rgba(24,20,14,.12)");
  }
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Glow
  const glow = ctx.createRadialGradient(w*.08, h*.95, 10, w*.08, h*.95, w*.48);
  glow.addColorStop(0, "rgba(224,171,93,.28)");
  glow.addColorStop(1, "rgba(224,171,93,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, h*.45, w*.7, h*.7);

  ctx.strokeStyle = "rgba(255,255,255,.2)";
  ctx.lineWidth = Math.max(2, w/1086);
  ctx.beginPath();
  ctx.moveTo(w*.16, h*.16);
  ctx.lineTo(w, h*.16);
  ctx.stroke();

  const scale = Math.min(w/1086, h/587);
  const left = w*.075;
  const top = h*.055;

  // Name
  const maxNameWidth = w * .85;
  let classSize = 88 * scale;
  let nameSize = 150 * scale;
  let className = profile.className || "CLASS";
  let name = profile.name || "名前未入力";
  let nameLineWidth;
  while (true) {
    ctx.font = `300 ${classSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
    const classWidth = ctx.measureText(className).width;
    ctx.font = `300 ${nameSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
    nameLineWidth = classWidth + w * .018 + ctx.measureText(name).width;
    if (nameLineWidth <= maxNameWidth || nameSize <= 24 * scale) break;
    classSize *= .92;
    nameSize *= .92;
  }

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `300 ${classSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  ctx.fillText(className, left, top + nameSize*.68);
  const classWidth = ctx.measureText(className).width;
  ctx.font = `300 ${nameSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  const nameX = left + classWidth + w*.018;
  ctx.fillText(name, nameX, top + nameSize*.68);

  const underlineY = top + nameSize*.82;
  ctx.lineWidth = Math.max(3, 5 * scale);
  ctx.beginPath();
  ctx.moveTo(left, underlineY);
  ctx.lineTo(w*.825, underlineY);
  ctx.stroke();

  // Nickname
  const nickname = profile.nickname || "nickname";
  const nickSize = fitFontSize(ctx, nickname, 58 * scale, maxNameWidth, 28 * scale);
  ctx.font = `400 ${nickSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  ctx.fillText(nickname, left, top + nameSize*1.22);
  const nickWidth = ctx.measureText(nickname).width;
  ctx.lineWidth = Math.max(2, 2 * scale);
  ctx.beginPath();
  ctx.moveTo(left, top + nameSize*1.26);
  ctx.lineTo(left + nickWidth, top + nameSize*1.26);
  ctx.stroke();

  // Hobbies
  const hobbyText = (profile.hobbies || []).join("・") || "未入力";
  let hobbySize = 52 * scale;
  let hobbyLines;
  ctx.fillStyle = "#fff";
  do {
    ctx.font = `400 ${hobbySize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
    hobbyLines = wrapText(ctx, `趣味：${hobbyText}`, maxNameWidth);
    if (hobbyLines.length <= 6) break;
    hobbySize *= Math.max(.72, 6 / hobbyLines.length * .95);
  } while (hobbySize > 24 * scale);
  const hobbyLineHeight = Math.min(hobbySize * 1.25, h * .34 / hobbyLines.length);
  const hobbyStartY = h * .57 - (hobbyLines.length - 1) * hobbyLineHeight / 2;
  hobbyLines.forEach((line, index) => {
    ctx.fillText(line, left, hobbyStartY + index * hobbyLineHeight);
  });

  // Talent
  ctx.fillStyle = "#fff";
  const talentText = `隠れた特技：${profile.talent || "特技を入力"}`;
  const talentSize = fitFontSize(ctx, talentText, 58 * scale, maxNameWidth, 26 * scale);
  ctx.font = `400 ${talentSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  ctx.fillText(talentText, left, h*.88);

  return canvas;
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";

  for (const char of text) {
    const nextLine = line + char;
    if (line && ctx.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = nextLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitFontSize(ctx, text, startingSize, maxWidth, minimumSize) {
  ctx.font = `400 ${startingSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const fontSize = Math.max(minimumSize, startingSize * Math.min(1, maxWidth / textWidth));
  ctx.font = `400 ${fontSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  return fontSize;
}

async function downloadPng() {
  // 現在のフォーム内容をCanvas画像に変換し、プロフィール名をファイル名にして保存する。
  try {
    const profile = getProfileFromForm();
    const canvas = await drawCardToCanvas(profile);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) resolve(result);
        else reject(new Error("PNG画像を生成できませんでした"));
      }, "image/png");
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (profile.name || "person-card").replace(/[\\/:*?"<>|]/g, "_");
    a.href = url;
    a.download = `${safe}_A5.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("PNGを書き出しました");
  } catch (error) {
    console.error("PNGの書き出しに失敗しました:", error);
    showToast("背景画像を含むPNGを書き出せませんでした");
  }
}

const PRINT_EXPORT_DIR_NAME = "KosenFestivalPrints";

async function savePngToPrintFolder(blob, fileName) {
  if (!window.showDirectoryPicker) return null;

  try {
    const selectedFolder = await window.showDirectoryPicker({ mode: "readwrite" });
    const targetFolder = await selectedFolder.getDirectoryHandle(PRINT_EXPORT_DIR_NAME, { create: true });
    const fileHandle = await targetFolder.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { folderName: PRINT_EXPORT_DIR_NAME, fileName };
  } catch (error) {
    if (error && error.name === "AbortError") return null;
    throw error;
  }
}

function openPrintPreview(blob, fileName) {
  const nextUrl = URL.createObjectURL(blob);
  if (els.printPreviewImage.dataset.objectUrl) {
    URL.revokeObjectURL(els.printPreviewImage.dataset.objectUrl);
  }

  els.printPreviewImage.src = nextUrl;
  els.printPreviewImage.dataset.objectUrl = nextUrl;
  els.printPreviewImage.alt = `${fileName} の印刷プレビュー`;
  els.printPreviewTitle.textContent = `${fileName}`;
  els.printPreviewModal.classList.add("show");
  els.printPreviewModal.setAttribute("aria-hidden", "false");
}

function closePrintPreview() {
  els.printPreviewModal.classList.remove("show");
  els.printPreviewModal.setAttribute("aria-hidden", "true");
  if (els.printPreviewImage.dataset.objectUrl) {
    URL.revokeObjectURL(els.printPreviewImage.dataset.objectUrl);
    delete els.printPreviewImage.dataset.objectUrl;
  }
  els.printPreviewImage.removeAttribute("src");
}

async function printCard() {
  try {
    const profile = getProfileFromForm();
    const canvas = await drawCardToCanvas(profile);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) resolve(result);
        else reject(new Error("PNG画像を生成できませんでした"));
      }, "image/png");
    });

    const safe = (profile.name || "person-card").replace(/[\\/:*?\"<>|]/g, "_");
    const fileName = `${safe}_A5.png`;

    try {
      const saved = await savePngToPrintFolder(blob, fileName);
      if (saved) {
        openPrintPreview(blob, fileName);
        showToast(`${saved.folderName} フォルダにPNGを保存しました`);
        return;
      }
    } catch (error) {
      console.warn("保存用フォルダの作成に失敗したため、通常のダウンロードへ切り替えます:", error);
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    openPrintPreview(blob, fileName);
    showToast("PNGを保存して印刷プレビューを表示しました");
  } catch (error) {
    console.error("印刷用PNGの作成に失敗しました:", error);
    showToast("印刷用PNGの準備に失敗しました");
  }
}

els.addHobbyBtn.addEventListener("click", () => {
  if (hobbyValues.length >= MAX_HOBBIES) return;
  hobbyValues.push("");
  renderHobbies();
  updatePreview();
  const inputs = els.hobbyInputs.querySelectorAll("input");
  inputs[inputs.length - 1]?.focus();
});

els.saveBtn.addEventListener("click", saveCurrent);
els.newBtn.addEventListener("click", () => {
  resetForm();
  showToast("新規プロフィールを作成します");
});
els.printBtn.addEventListener("click", printCard);
els.pngBtn.addEventListener("click", downloadPng);
els.printPreviewClose.addEventListener("click", closePrintPreview);
els.printPreviewAction.addEventListener("click", () => {
  window.print();
});
els.printPreviewModal.addEventListener("click", (event) => {
  if (event.target === els.printPreviewModal) closePrintPreview();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.printPreviewModal.classList.contains("show")) {
    closePrintPreview();
  }
});

els.clearAllBtn.addEventListener("click", () => {
  if (!loadProfiles().length) return;
  if (!confirm("保存済みプロフィールをすべて削除しますか？")) return;
  saveProfiles([]);
  resetForm();
  renderSavedList();
  showToast("すべて削除しました");
});

els.form.addEventListener("input", updatePreview);
els.theme.addEventListener("change", updatePreview);
els.orientation.addEventListener("change", updatePreview);


// ========================================
// 人物一覧の操作
// ========================================
// 検索・並び替え・選択状態の管理をイベント駆動で行う

// 複数削除
els.bulkDeleteBtn.addEventListener(
  "click",
  bulkDeleteSelected
);

// CSV出力
els.exportCsvBtn.addEventListener(
  "click",
  exportProfilesCsv
);

// 検索
els.profileSearch.addEventListener(
  "input",
  renderSavedList
);

// 並び替え
els.profileSort.addEventListener(
  "change",
  renderSavedList
);

// 全選択
els.selectAllProfiles.addEventListener(
  "change",
  () => {

    const visibleChecks =
      els.savedList.querySelectorAll(
        ".profile-check"
      );

    visibleChecks.forEach(
      checkbox => {

        checkbox.checked =
          els.selectAllProfiles.checked;

      }
    );

    updateSelectionUI();

  }
);


renderHobbies([]);
renderSavedList();
updatePreview();
renderHobbyRanking();
syncHobbyRanking();
setInterval(refreshHobbyRanking, 30000);
