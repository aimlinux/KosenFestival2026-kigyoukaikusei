
const companies = [
{
name: "株式会社八雲ソフトウェア",
domain: "8clouds.co.jp",
category: "IT・ソフトウェア開発",
description:
    "業務システムやWeb・スマートフォンアプリの開発に加え、kintoneなどを活用したDX推進・業務改善を支援するソフトウェア企業です。",
website: "https://8clouds.co.jp/",
recruit: "https://8clouds.co.jp/job/new_graduates/",
label: "YAKUMO SOFTWARE"
},
{
name: "鳥取電業株式会社",
domain: "www.tottoridengyo.co.jp",
category: "電気・設備・地域インフラ",
description:
    "住宅・産業・情報関連製品の販売、設備工事、上下水道ポンプなどの保守管理を通じて地域の暮らしを支えています。",
website: "https://www.tottoridengyo.co.jp/",
recruit: "https://www.tottoridengyo.co.jp/recruit/",
label: "TOTTORI DENGYO"
},
{
name: "岡田電工株式会社",
domain: "okakou.sdgr.co.jp",
category: "電気・水道・空調・通信工事",
description:
    "米子市西福原に本社を置き、電気・水道・空調・通信工事を通じて、快適で安心な暮らしづくりや地域づくりに貢献しています。",
website: "https://okakou.sdgr.co.jp/",
recruit: "https://okakou.sdgr.co.jp/recruit/",
label: "OKADA DENKO"
},
{
name: "美保テクノス株式会社",
domain: "www.miho.co.jp",
category: "総合建設・まちづくり",
description:
    "土木・建築工事をはじめ、道路維持管理、地盤改良、住宅、設計などを通じて地域のまちづくりに取り組んでいます。",
website: "https://www.miho.co.jp/",
recruit: "https://www.miho.co.jp/recruit/recruit_01.html",
label: "MIHO TECHNOS"
},
{
name: "株式会社TAKURAMI",
domain: "takurami.jp",
category: "イベント企画・演出・空間づくり",
description:
    "イベントの企画・コンサルティング、制作・演出、運営進行、施工・空間創造などを手がけています。",
website: "https://takurami.jp/web/",
recruit: "",
label: "TAKURAMI"
}
];

// QRコードを生成
function createQR(url) {
return (
"https://api.qrserver.com/v1/create-qr-code/" +
"?size=220x220&margin=8&data=" +
encodeURIComponent(url)
);
}

// 公式サイトのファビコンをロゴ欄に利用
function createLogo(domain) {
return (
"https://www.google.com/s2/favicons?domain=" +
encodeURIComponent(domain) +
"&sz=128"
);
}

// HTMLに挿入する文字列をエスケープ
function escapeHTML(value) {
return String(value).replace(/[&<>"']/g, char => ({
"&": "&amp;",
"<": "&lt;",
">": "&gt;",
'"': "&quot;",
"'": "&#39;"
})[char]);
}

// QRコードまたはURL未設定の案内を作成
function makeQR(url, label) {
if (url) {
return `
    <a class="qr-link"
        href="${escapeHTML(url)}"
        target="_blank"
        rel="noopener noreferrer">

    <img
        src="${createQR(url)}"
        alt="${escapeHTML(label)}のQRコード">

    <strong>${escapeHTML(label)}</strong>
    <small>読み取ってアクセス</small>
    </a>
`;
}

return `
<div class="qr-link">
    <div class="qr-fallback">
    URL確認後に<br>QRコードを表示
    </div>
    <strong>${escapeHTML(label)}</strong>
    <small>リンク設定待ち</small>
</div>
`;
}

// 企業カードを生成して表示
const container = document.getElementById("companies");

container.innerHTML = companies.map((company, index) => `
<article class="company">

<div class="brand">
    ${
    company.domain
        ? `<img
            src="${createLogo(company.domain)}"
            alt="${escapeHTML(company.name)}のロゴ"
            onerror="this.style.display='none'">`
        : ""
    }

    <div class="brand-word">
    ${escapeHTML(company.label)}
    </div>
</div>

<div class="company-top">
    <div class="num">
    ${String(index + 1).padStart(2, "0")}
    </div>

    <div>
    <h3>${escapeHTML(company.name)}</h3>

    <span class="category">
        ${escapeHTML(company.category)}
    </span>
    </div>
</div>

<p class="description">
    ${escapeHTML(company.description)}
</p>

<div class="links">
    ${makeQR(company.website, "公式ホームページ")}
    ${makeQR(company.recruit, "採用ページ")}
</div>

<div class="visit">
    ${
    company.website
        ? `<a href="${escapeHTML(company.website)}"
            target="_blank"
            rel="noopener noreferrer">
            公式サイトを開く
            </a>`
        : `<span class="pill">正式URL確認後に公開</span>`
    }
</div>

</article>
`).join("");
