
String.prototype.hashCode = function() {
    var hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

/**
 * @type Book
 */
let book;

/**
 * @type Renderer
 */
let renderer;

let $content;

let currentPage = 0;

const goto = (from, link, callback) => {
    const filePath = link.includes("#")? link.substring(0, link.indexOf("#")) : link;
    const file = book.getFile(appendPath(getDirFromPath(from), fixPath(filePath)));
    const index = book.getSpineIndex(file);

    const startPage = currentPage;

    $(".loading-overlay").show();

    const onReady = () => {
        const url = location.href;
        if(link.includes("#")) {
            location.href = link.substring(link.indexOf("#"));
            history.replaceState(null, null, url); 
        }
        else {
            location.href = "#GOTO_" + file.id.hashCode();
            history.replaceState(null, null, url); 
        } 
        $(".loading-overlay").hide();
        if(callback) callback();
    }

    const loadLoop = () => {
        if(currentPage < index) {
            $("#loading-percent").text(Math.round((currentPage - startPage) / (index - startPage) * 100));
            loadPage(currentPage + 1, loadLoop);
        }
        else 
            onReady();
    }

    if(index <= currentPage) {
        onReady();
    }
    else {
        loadLoop();
    }
};

const loadPage = (index, callback) => {
    const file = book.getFileBySpineIndex(index);
    renderer.render(file, $content, () => {
        currentPage = index;
        console.log("Loaded " + file.href);
        if (callback) callback();
    }, console.log, {
        gotoFn: goto
    });
};

function populateTableOfContents() {
    $(".toc-holder").show();
    const $toc = $("#table-of-contents");
    $toc.html("");

    if(book.tableOfContents.length == 0) {
        const $item = $(document.createElement("li"));
        $item.text("This book does not contain a table of contents.");
        $toc.append($item);
    }
    else {
        for (const item of book.tableOfContents) {
            const $item = $(document.createElement("li"));
            const $a = $(document.createElement("a"));
            $a.text(item.label);
            $a.click(() => {
                goto(book.ncxPath, item.link, closeMenu);
            });
            $item.append($a);
            $toc.append($item);
        }
    }
    

    $("#book-title").text(book.title);
}

function closeMenu() {
    $(".overlay").hide();
}

const detectNextPageLoad = () => {
    if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50) {
        loadPage(currentPage + 1);
    }
};

const openFile = f => {
    currentPage = 0;
    $content.html("");

    Book.open(f, b => {
        book = b;
        renderer = new Renderer(book);
        populateTableOfContents();
        $content.html("");
        loadPage(0, () => {
            detectNextPageLoad();
            closeMenu();
        });
    },
    e => {
        alert("Invalid file. Please contact the developer of this app if you disagree. Please ignore the text below.\n\n" + e);
    });
};

$(document).ready(() => {

    $content = $("#content");

    let $files = $("#file");
    if($files[0].files.length > 0) {
        openFile($files[0].files[0]);
    }

    $("#btn-open-file").click(() => {
        $files.trigger('click');
    });

    $("#btn-load-more").click(() => {
        loadPage(currentPage + 1);
    });

    $("#btn-scroll-to-top").click(() => {
        window.scrollTo(0, 0); 
        closeMenu();
    });

    var viewFullScreen = document.getElementById("fullscreen");
    if (viewFullScreen) {
        viewFullScreen.addEventListener("click", function() {
            var docElm = document.documentElement;
            if (docElm.requestFullscreen) {
                docElm.requestFullscreen();
            } else if (docElm.msRequestFullscreen) {
                docElm.msRequestFullscreen();
            } else if (docElm.mozRequestFullScreen) {
                docElm.mozRequestFullScreen();
            } else if (docElm.webkitRequestFullScreen) {
                docElm.webkitRequestFullScreen();
            }
        });
    }

    window.onscroll = detectNextPageLoad;

    $("#file").on("change", function(evt) {
        var files = evt.target.files;
        openFile(files[0]);
    });

    $("#btn-menu").click(() => {
        $(".overlay").show();
    });

    $("#btn-exit-menu").click(() => {
        $(".overlay").hide();
    });
});

