export async function copyText(text) {
    await navigator.clipboard.writeText(text);
}

// Chrome's clipboard cannot hold an animated GIF as an image (image/png only), so we
// write multiple formats at once and let the paste target pick the richest one it
// supports: editors that honour pasted HTML take that and fetch the animated GIF
// (Teams and Slack do, Gmail does not), image consumers take the PNG still frame,
// and plain editors take the URL. Discord ignores the HTML and uploads the PNG as a
// static attachment, so copying the link is the answer there.
export async function copyImage(url) {
    const html = new Blob([`<img src="${url}" alt="GIF">`], { type: 'text/html' });
    const text = new Blob([url], { type: 'text/plain' });
    const formats = { 'text/html': html, 'text/plain': text };

    try {
        const res = await fetch(url);
        const bitmap = await createImageBitmap(await res.blob());
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (png) formats['image/png'] = png;
    } catch {
        // Still-frame extraction is best-effort; HTML + URL formats still go out.
    }

    await navigator.clipboard.write([new ClipboardItem(formats)]);
}
