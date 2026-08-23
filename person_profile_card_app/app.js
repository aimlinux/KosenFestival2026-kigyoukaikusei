const $ = (id) => document.getElementById(id);

const els = {
  form: $("profileForm"),
  name: $("name"),
  className: $("className"),
  nickname: $("nickname"),
  talent: $("talent"),
  tags: $("tags"),
  theme: $("theme"),
  orientation: $("orientation"),
  hobbyInputs: $("hobbyInputs"),
  hobbyCount: $("hobbyCount"),
  addHobbyBtn: $("addHobbyBtn"),
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
  previewTags: $("previewTags"),
  previewTalent: $("previewTalent"),
  toast: $("toast")
};

let currentId = null;
let hobbyValues = [];

const STORAGE_KEY = "person-card-studio-profiles-v1";

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function normalizeText(value) {
  return value.trim();
}

function renderHobbies(values = hobbyValues) {
  hobbyValues = values.slice(0, 6);
  els.hobbyInputs.innerHTML = "";

  hobbyValues.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "hobby-row";

    const input = document.createElement("input");
    input.maxLength = 30;
    input.placeholder = `趣味 ${index + 1}`;
    input.value = value;
    input.addEventListener("input", () => {
      hobbyValues[index] = input.value;
      updatePreview();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-hobby";
    remove.textContent = "×";
    remove.title = "削除";
    remove.addEventListener("click", () => {
      hobbyValues.splice(index, 1);
      renderHobbies();
      updatePreview();
    });

    row.append(input, remove);
    els.hobbyInputs.appendChild(row);
  });

  els.hobbyCount.textContent = `${hobbyValues.length} / 6`;
  els.addHobbyBtn.disabled = hobbyValues.length >= 6;
}

function getProfileFromForm() {
  const hobbies = hobbyValues.map(normalizeText).filter(Boolean);
  return {
    id: currentId || crypto.randomUUID(),
    name: normalizeText(els.name.value) || "名前未入力",
    className: normalizeText(els.className.value) || "CLASS",
    nickname: normalizeText(els.nickname.value),
    hobbies,
    talent: normalizeText(els.talent.value),
    tags: normalizeText(els.tags.value),
    theme: els.theme.value,
    orientation: els.orientation.value,
    updatedAt: new Date().toISOString()
  };
}

function autoTags(profile) {
  if (profile.tags) return profile.tags;
  return profile.hobbies.map(h => "#" + h.replace(/\s+/g, "")).join("　");
}

function updatePreview() {
  const profile = getProfileFromForm();

  els.previewClass.textContent = profile.className;
  els.previewName.textContent = profile.name;
  els.previewNickname.textContent = profile.nickname ? profile.nickname : "nickname";
  els.previewTags.textContent = autoTags(profile) || "#趣味";
  els.previewTalent.textContent = profile.talent || "特技を入力";

  els.card.classList.remove("theme-purple", "theme-blue", "theme-green");
  els.card.classList.add(`theme-${profile.theme}`);

  els.previewStage.classList.toggle("portrait", profile.orientation === "portrait");
  els.previewStage.classList.toggle("landscape", profile.orientation !== "portrait");

  els.status.textContent = currentId ? "編集モード" : "未保存";
}

function resetForm() {
  currentId = null;
  els.form.reset();
  hobbyValues = [];
  renderHobbies();
  els.theme.value = "purple";
  els.orientation.value = "landscape";
  updatePreview();
}

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function saveCurrent() {
  if (!normalizeText(els.name.value)) {
    els.name.focus();
    showToast("名前を入力してください");
    return;
  }

  const profile = getProfileFromForm();
  const profiles = loadProfiles();
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
  const profile = loadProfiles().find(p => p.id === id);
  if (!profile) return;

  currentId = profile.id;
  els.name.value = profile.name || "";
  els.className.value = profile.className || "";
  els.nickname.value = profile.nickname || "";
  els.talent.value = profile.talent || "";
  els.tags.value = profile.tags || "";
  els.theme.value = profile.theme || "purple";
  els.orientation.value = profile.orientation || "landscape";
  renderHobbies(profile.hobbies || []);
  updatePreview();
  showToast("プロフィールを読み込みました");
}

function deleteProfile(id) {
  const profiles = loadProfiles().filter(p => p.id !== id);
  saveProfiles(profiles);
  if (currentId === id) resetForm();
  renderSavedList();
  showToast("削除しました");
}

function renderSavedList() {
  const profiles = loadProfiles();
  els.savedList.innerHTML = "";

  if (!profiles.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "まだ保存されていません";
    els.savedList.appendChild(empty);
    return;
  }

  profiles.forEach(profile => {
    const item = document.createElement("div");
    item.className = "saved-item";

    const main = document.createElement("div");
    main.className = "saved-item-main";
    main.innerHTML = `
      <div class="saved-item-name"></div>
      <div class="saved-item-meta"></div>
    `;
    main.querySelector(".saved-item-name").textContent = profile.name;
    main.querySelector(".saved-item-meta").textContent =
      `${profile.className || "CLASS"} / ${(profile.hobbies || []).length}個の趣味`;
    main.addEventListener("click", () => loadProfile(profile.id));

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "削除";
    del.addEventListener("click", () => deleteProfile(profile.id));

    item.append(main, del);
    els.savedList.appendChild(item);
  });
}

function wrapText(ctx, text, maxWidth, fontSize) {
  const chars = [...text];
  const lines = [];
  let line = "";

  for (const char of chars) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCardToCanvas(profile, width = 2480, height = 1748) {
  const canvas = document.createElement("canvas");
  const portrait = profile.orientation === "portrait";
  canvas.width = portrait ? height : width;
  canvas.height = portrait ? width : height;

  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  // Background
  ctx.fillStyle = "#080a10";
  ctx.fillRect(0, 0, w, h);

  const purple = profile.theme === "purple";
  const blue = profile.theme === "blue";
  const green = profile.theme === "green";

  const grad = ctx.createLinearGradient(0, 0, w * .5, h * .65);
  if (green) {
    grad.addColorStop(0, "rgba(23,173,111,.95)");
    grad.addColorStop(.3, "rgba(23,173,111,.20)");
  } else if (blue) {
    grad.addColorStop(0, "rgba(0,91,255,.95)");
    grad.addColorStop(.3, "rgba(0,91,255,.20)");
  } else {
    grad.addColorStop(0, "rgba(112,45,255,.96)");
    grad.addColorStop(.3, "rgba(112,45,255,.22)");
  }
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Glow
  const glow = ctx.createRadialGradient(w*.08, h*.95, 10, w*.08, h*.95, w*.48);
  glow.addColorStop(0, "rgba(0,205,255,.65)");
  glow.addColorStop(1, "rgba(0,205,255,0)");
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
  const classSize = 62 * scale;
  const nameSize = 105 * scale;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `300 ${classSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  ctx.fillText(profile.className || "CLASS", left, top + nameSize*.65);

  const classWidth = ctx.measureText(profile.className || "CLASS").width;
  ctx.font = `300 ${nameSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  const nameX = left + classWidth + w*.018;
  ctx.fillText(profile.name || "名前未入力", nameX, top + nameSize*.68);

  const underlineY = top + nameSize*.84;
  ctx.lineWidth = Math.max(3, 5 * scale);
  ctx.beginPath();
  ctx.moveTo(left, underlineY);
  ctx.lineTo(w*.825, underlineY);
  ctx.stroke();

  // Nickname
  const nickSize = 40 * scale;
  ctx.font = `400 ${nickSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  const nickname = profile.nickname || "nickname";
  ctx.fillText(nickname, left, top + nameSize*1.22);
  const nickWidth = ctx.measureText(nickname).width;
  ctx.lineWidth = Math.max(2, 2 * scale);
  ctx.beginPath();
  ctx.moveTo(left, top + nameSize*1.26);
  ctx.lineTo(left + nickWidth, top + nameSize*1.26);
  ctx.stroke();

  // Tags
  const tags = autoTags(profile) || "#趣味";
  const tagSize = 45 * scale;
  ctx.fillStyle = "#00baff";
  ctx.font = `400 ${tagSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  const tagLines = wrapText(ctx, tags, w*.86, tagSize);
  let tagY = h*.51;
  tagLines.slice(0, 3).forEach(line => {
    ctx.fillText(line, left*.42, tagY);
    tagY += tagSize*1.35;
  });

  // Talent
  ctx.fillStyle = "#fff";
  const talentSize = 27 * scale;
  ctx.font = `400 ${talentSize}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  ctx.fillText("隠れた特技：", left*.72, h*.735);
  ctx.font = `400 ${32 * scale}px "Yu Gothic", "Noto Sans JP", sans-serif`;
  ctx.fillText(profile.talent || "特技を入力", left*.72, h*.84);

  return canvas;
}

function downloadPng() {
  const profile = getProfileFromForm();
  const canvas = drawCardToCanvas(profile);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (profile.name || "person-card").replace(/[\\/:*?"<>|]/g, "_");
    a.href = url;
    a.download = `${safe}_A5.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("PNGを書き出しました");
  }, "image/png");
}

function printCard() {
  window.print();
}

els.addHobbyBtn.addEventListener("click", () => {
  if (hobbyValues.length >= 6) return;
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

els.clearAllBtn.addEventListener("click", () => {
  if (!loadProfiles().length) return;
  if (!confirm("保存済みプロフィールをすべて削除しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  resetForm();
  renderSavedList();
  showToast("すべて削除しました");
});

els.form.addEventListener("input", updatePreview);
els.theme.addEventListener("change", updatePreview);
els.orientation.addEventListener("change", updatePreview);

renderHobbies([]);
renderSavedList();
updatePreview();
