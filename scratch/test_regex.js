const fixedBase = 'file:///data/user/0/host.exp.exponent/files/media/';
function test(html) {
  return html.replace(
    /<(img|video|audio|source|track)(\s[^>]*?)src=(?:["']([^"']+)["']|([^\s>]+))([^>]*)>/gi,
    (match, tag, before, qSrc, unqSrc, after) => {
      const rawSrc = (qSrc || unqSrc || '').trim();
      if (!rawSrc) return match;
      if (
        rawSrc.startsWith('http://') ||
        rawSrc.startsWith('https://') ||
        rawSrc.startsWith('data:') ||
        rawSrc.startsWith('file://')
      ) {
        return match;
      }
      const cleanSrc = rawSrc.replace(/^\.\//, '');
      const fullSrc = fixedBase ? fixedBase + cleanSrc : cleanSrc;
      return `<${tag}${before}src="${fullSrc}"${after}>`;
    }
  );
}

console.log('1:', test('<img src="test.jpg">'));
console.log('2:', test('<img src="test.jpg" />'));
console.log('3:', test('<img class="foo" src="test.jpg">'));
console.log('4:', test('<IMG SRC="test.jpg">'));
console.log('5:', test('<img src="paste-123.png">'));
console.log('6:', test('<img src="my image.jpg">'));
console.log('7:', test('<img src="my%20image.jpg">'));
console.log('8:', test('<img src="test.jpg" width="100">'));
console.log('9:', test('<div><img src="test.jpg"></div>'));
console.log('10:', test('<img  src="test.jpg">'));
console.log('11:', test('<img\nsrc="test.jpg">'));
