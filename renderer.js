
class Renderer {
    /**
     * @type Book
     */
    book;

    loading = false;

    constructor(book) {
        this.book = book;
    }

    processPage(file, onsuccess, onerror, options) {
        if(this.loading) return;

        this.loading = true;

        this.book.openFile(file.href, "text", txt => {
            const $a = $("<a id='GOTO_" + file.id.hashCode() + "' ></a>");
            const $page = $("<div>" + txt + "</div>");

            for(const img of $page.find("img")) {
                this.book.openContent(img.getAttribute("src"), "blob", blob => {
                    img.src = URL.createObjectURL(blob);
                });
                img.classList.add("centered-image");
            }

            for (const img of $page.find("image")) {
                const $newImage = $(img);
                this.book.openContent($newImage.attr("xlink:href"), "blob", blob => {
                    $newImage.attr("xlink:href", URL.createObjectURL(blob));
                });
            }

            for (const a of $page.find("a")) {
                const $a = $(a);
                const link = $a.attr("href") || "";
                if(link.startsWith("http://") || link.startsWith("https://")) {
                    $a.attr("target", "_blank");
                    continue;
                }
                $a.removeAttr("href");

                if(options && options.gotoFn)
                    $a.click(() => {
                        options.gotoFn(link);
                    });
            }

            for (const element of $page.find("style")) {
                $(element).remove();
            }

            $page.prepend($a);

            this.loading = false;
            if(onsuccess) onsuccess($page);

        }, e => {
            this.loading = false;
            if(onerror) onerror(e);
        });
    }

    render(file, $element, onsuccess, onerror, options) {
        this.processPage(file, $doc => {
            $element.append($doc);
            if(onsuccess) onsuccess($doc);
        }, onerror, options);
    }
}