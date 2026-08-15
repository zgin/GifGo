export async function copyText(text) {
    await navigator.clipboard.writeText(text);
}

// Chrome's clipboard cannot hold an animated GIF as an image (image/png only), so we
// write multiple formats at once and let the paste target pick the richest one it
// supports: rich-text editors (Gmail, Slack, Discord) take the HTML and paste the
// animated GIF, image consumers take the PNG still frame, plain editors take the URL.
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
