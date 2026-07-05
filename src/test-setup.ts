// Vitest setup: jsdom's Blob implementation is missing the async reader helpers
// (`Blob.prototype.text` / `arrayBuffer`) that browsers provide. Polyfill them on
// top of jsdom's own FileReader so blob round-trip tests behave like a real browser.
// We must NOT replace the global Blob class — jsdom's FileReader brand-checks its
// own Blob instances, so swapping in Node's Blob would break readAsDataURL.
const blobProto = Blob.prototype as unknown as {
  arrayBuffer?: () => Promise<ArrayBuffer>;
  text?: () => Promise<string>;
};

if (typeof blobProto.arrayBuffer !== 'function') {
  blobProto.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof blobProto.text !== 'function') {
  blobProto.text = async function text(this: Blob): Promise<string> {
    const buffer = await this.arrayBuffer!();
    return new TextDecoder().decode(buffer);
  };
}
