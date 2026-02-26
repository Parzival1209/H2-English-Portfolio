/* ================= Setup for JavaScript and Other Things ================= */
const navType = performance.getEntriesByType("navigation")[0]?.type;
const parser = new DOMParser();
let isOnFrontCover = false;
let hasFrontCover = false;
let isOnBackCover = false;
let hasBackCover = false;
let frontCoverHTML = "";
let backCoverHTML = "";
let currentPage = 0;
const pageStep = 2;
let pages = [];

if (navType === "reload" || navType === "back_forward") {
    sessionStorage.removeItem("clickedLinks");
}

document.addEventListener("DOMContentLoaded", () => {
    setupPageReRendering();
    setupPageTurning();
    paginateBook();
    if (hasFrontCover) isOnFrontCover = true;
    renderPages();
    renderLinkBorder();
});

/* ================= Pagination Engine ================= */
function paginateBook() {
    const source = document.querySelector("#book-source");
    const measurer = document.querySelector("#page-measurer .page-content");

    let backCoverIndex = null;
    measurer.innerHTML = "";
    let currentHTML = "";
    pages = [];

    Array.from(source.childNodes).forEach((node, index) => {
        if (backCoverIndex !== null) return;

        /* --- Front cover detection and creation --- */
        if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.id === "front-cover" &&
            node.nodeName === "IMG" &&
            index === 1
        ) {
            frontCoverHTML = node.outerHTML;
            hasFrontCover = true;
            return;
        }

        /* --- Back cover detection --- */
        if (
            node.nodeType === Node.COMMENT_NODE &&
            node.nodeValue.trim() === "Back Cover"
        ) {
            if (currentHTML.trim())
                pages.push(currentHTML);
            measurer.innerHTML = "";
            backCoverIndex = index;
            hasBackCover = true;
            backCoverHTML = "";
            currentHTML = "";
            return;
        }

        /* --- Forced page break --- */
        if (
            node.nodeType === Node.COMMENT_NODE &&
            node.nodeValue.trim() === "New Page"
        ) {
            if (currentHTML.trim())
                pages.push(currentHTML);
            measurer.innerHTML = "";
            currentHTML = "";
            return;
        }

        /* --- Automatic pagination/page break --- */
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const nodeHTMLString = ("" + node.innerHTML);
        const words = nodeHTMLString.split(/\s+/);
        const tempNode = node.cloneNode(true);
        measurer.appendChild(tempNode);
        tempNode.innerHTML = "";
        let currentText = "";
        words.forEach(word => {
            const tempText = currentText + word + " ";
            tempNode.innerHTML = tempText;
            if (measurer.scrollHeight > measurer.clientHeight) {
                tempNode.innerHTML = currentText;
                if ((tempNode.textContent.trim() || !(/(<\/.*>)$/.test(tempNode.outerHTML)))
                || tempNode.hasAttribute("data-visible"))
                    currentHTML += tempNode.outerHTML;
                pages.push(currentHTML);
                currentHTML = "";
                measurer.innerHTML = "";
                tempNode.innerHTML = "";
                currentText = word + " ";
            } else {
                currentText = tempText;
            }
        });
        tempNode.remove();
        if ((tempNode.textContent.trim() || !(/(<\/.*>)$/.test(tempNode.outerHTML)))
        || tempNode.hasAttribute("data-visible"))
            currentHTML += tempNode.outerHTML;
        measurer.appendChild(tempNode.cloneNode(true));
    });

    /* --- Back cover creation (no pagination) --- */
    if (hasBackCover && backCoverIndex !== null) {
        const sourceNodes = Array.from(source.childNodes);
        for (let i = backCoverIndex + 1; i < sourceNodes.length; i++) {
            const node = sourceNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
                backCoverHTML += node.outerHTML;
            }
        }
    }

    if (currentHTML.trim())
        pages.push(currentHTML);
    /* --- Ensure pages has an even number of pages --- */
    if (hasBackCover && pages.length % 2 !== 0) {
        pages.push("");
    }
}

/* ================= Rendering ================= */
function renderPages() {
    const leftPage = document.querySelector(".left-page");
    const rightPage = document.querySelector(".right-page");
    const leftContent = leftPage.querySelector(".page-content");
    const rightContent = rightPage.querySelector(".page-content");

    if (rightPage.querySelector("#front-cover") && hasFrontCover) {
        rightPage.querySelector("#front-cover").remove();
    };

    /* --- Front cover mode --- */
    if (isOnFrontCover && hasFrontCover) {
        const doc = parser.parseFromString(frontCoverHTML, 'text/html');
        rightPage.querySelector(".page-number").textContent = "";
        leftPage.querySelector(".page-number").textContent = "";
        rightPage.appendChild(doc.body.firstChild);
        rightPage.classList.add("front-cover");
        leftPage.classList.add("front-cover");
        rightContent.innerHTML = "";
        leftContent.innerHTML = "";
        setupUserFunctions();
        return;
    }

    /* --- Back cover mode --- */
    if (isOnBackCover && hasBackCover) {
        rightPage.querySelector(".page-number").textContent = "";
        leftPage.querySelector(".page-number").textContent = "";
        leftContent.innerHTML = backCoverHTML;
        rightPage.classList.add("back-cover");
        leftPage.classList.add("back-cover");
        rightContent.innerHTML = "";
        setupUserFunctions();
        return;
    }

    /* --- Normal mode --- */
    if (!isOnFrontCover && !isOnBackCover) {
        leftPage.classList.remove("back-cover");
        leftPage.classList.remove("front-cover");
        rightPage.classList.remove("back-cover");
        rightPage.classList.remove("front-cover");
        leftContent.innerHTML = pages[currentPage] || "";
        rightContent.innerHTML = pages[currentPage + 1] || "";
        leftPage.querySelector(".page-number").textContent = currentPage + 1;
        rightPage.querySelector(".page-number").textContent = currentPage + 2;
        setupUserFunctions();
    }
}

function renderLinkBorder() {
    const book = document.querySelector(".book");
    const clickedLinks = getClickedLinks();

    book.querySelectorAll("a").forEach(link => {
        const key = getLinkKey(link);

        /* --- Restore link clicked state --- */
        if (clickedLinks.includes(key)) {
            link.classList.add("clicked");
        }

        /* --- Save link key on click --- */
        link.addEventListener("click", () => {
            link.classList.add("clicked");
            saveClickedLink(key);
        });
    });
}

/* ================= Controls and Automation ================= */
function switchPage(goTo = "prev") {
    const isNext = goTo === "next";

    /* --- Leaving front cover --- */
    if (isOnFrontCover && isNext) {
        isOnFrontCover = false;
        currentPage = 0;
        renderPages();
        renderLinkBorder();
        return;
    }

    /* --- Returning to front cover --- */
    if (!isOnFrontCover && !isNext && currentPage === 0 && hasFrontCover && !isOnBackCover) {
        isOnFrontCover = true;
        currentPage = 0;
        renderPages();
        renderLinkBorder();
        return;
    }

    /* --- Leaving back cover --- */
    if (isOnBackCover && !isNext) {
        currentPage = (pages.length-pageStep);
        isOnBackCover = false;
        renderPages();
        renderLinkBorder();
        return;
    }

    /* --- Returning to back cover --- */
    if (!isOnBackCover && isNext && currentPage === (pages.length-pageStep) && hasBackCover && !isOnFrontCover) {
        currentPage = (pages.length-pageStep);
        isOnBackCover = true;
        renderPages();
        renderLinkBorder();
        return;
    }

    /* --- Normal page switching --- */
    if (isNext) {
        if (currentPage + pageStep < pages.length) {
            currentPage += pageStep;
            renderPages();
            renderLinkBorder();
        }
    } else {
        if (currentPage - pageStep >= 0) {
            currentPage -= pageStep;
            renderPages();
            renderLinkBorder();
        }
    }
}

function setupPageTurning() {
    /* --- Setup navigation buttons --- */
    document.getElementById("nextPage").addEventListener("click", () => switchPage("next"));
    document.getElementById("prevPage").addEventListener("click", () => switchPage("prev"));

    /* --- Setup arrow keys --- */
    document.addEventListener("keydown", (e) => {
        const activeElement = document.activeElement;
        if (activeElement) {
            const nodeName = activeElement.nodeName;
            const isFocused = (nodeName === "INPUT" || nodeName === "TEXTAREA");
            if (!isFocused) {
                if (e.key === "ArrowRight") {
                    e.preventDefault();
                    switchPage("next");
                } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    switchPage("prev");
                }
            }
        }
    });
}

function setupPageReRendering() {
    /* --- Setup full-screen detection --- */
    document.addEventListener("fullscreenchange", () => {
        paginateBook();
        renderPages();
        renderLinkBorder();
    });

    /* --- Setup resize detection --- */
    window.addEventListener("resize", () => {
        paginateBook();
        renderPages();
        renderLinkBorder();
    });
}

function getClickedLinks() {
    return JSON.parse(sessionStorage.getItem("clickedLinks") || "[]");
}

function getLinkKey(link) {
    return link.getAttribute("href")
        ? "href:" + link.getAttribute("href")
        : link.getAttribute("id")
        ? "id:" + link.getAttribute("id")
        : "text:" + link.textContent.trim();
}

function saveClickedLink(key) {
    const clickedLinks = getClickedLinks();
    if (!clickedLinks.includes(key)) {
        clickedLinks.push(key);
        sessionStorage.setItem("clickedLinks", JSON.stringify(clickedLinks));
    }
}

/* ----- Call Your Functions Here (For User) ----- */
function setupUserFunctions() {
    setupCommentLink();
    setupCommentForm();
}

/* ================= Add Your Own JavaScript Here (For User) ================= */
function setupCommentLink() {
    const commentLink = document.getElementById("comment-link");
    commentLink.addEventListener("click", e => {
        e.preventDefault();
        currentPage = (pages.length-pageStep);
        switchPage("next");
    });
}

function setupCommentForm() {
    const commentForm = document.getElementById("comment-form");
    commentForm.addEventListener("submit", async e => {
        e.preventDefault();
        const name = document.getElementById("comment-form-name");
        const comment = document.getElementById("comment-form-comment");
        const message = document.getElementById("comment-form-message");
        const fetchURL = "https://script.google.com/macros/s/AKfycby7VCOZG2I9tH-2YkP2sveTQfUoI45Ski26tgNKYj0BYLDgj2e8ljP_txmo5sDDYRnllw/exec";

        let dots = "";
        message.style.color = "black";
        message.textContent = "Submitting";
        const submitInterval = setInterval(() => {
            dots = (dots.length < 3) ? dots + "." : "";
            message.textContent = "Submitting" + dots;
        }, 500);

        try {
            let response = await fetch(fetchURL, {
                method: "POST",
                body: JSON.stringify({
                    "name": name.value.trim(),
                    "comment": comment.value.trim()
                })
            });
            response = await response.text();
            clearInterval(submitInterval);

            if (response === "200 OK") {
                name.value = "";
                comment.value = "";
                message.style.color = "green";
                message.textContent = "Comment submitted!";
                setTimeout(() => {message.textContent = "";}, 2500);
            } else if (response.startsWith("API Error: ")) {
                message.style.color = "red";
                message.textContent = response;
            } else {
                message.style.color = "red";
                message.textContent = response;
                setTimeout(() => {message.textContent = "";}, 2500);
            }
        } catch (err) {
            message.style.color = "red";
            message.textContent = "API error: " + err.toString() + ".";
        }
    });
}
