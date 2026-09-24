const { isSafeExternalUrl, escapeXml } = require('../src/lib/urls');

describe('isSafeExternalUrl', () => {
  test.each([
    'https://campus.unrn.edu.ar/mod/lti/service.php',
    'https://moodle.example.com:8443/webservice/rest/server.php',
    'https://8.8.8.8/outcome'
  ])('accepts public HTTPS url %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(true);
  });

  test.each([
    'http://campus.unrn.edu.ar/mod/lti/service.php',
    'https://localhost/outcome',
    'https://127.0.0.1/outcome',
    'https://10.0.0.5/outcome',
    'https://172.20.1.1/outcome',
    'https://192.168.1.10/outcome',
    'https://169.254.169.254/computeMetadata/v1/',
    'https://metadata.google.internal/computeMetadata/v1/',
    'https://[::1]/outcome',
    'https://[fd00::1]/outcome',
    'https://[::ffff:127.0.0.1]/outcome',
    'https://user:pass@campus.unrn.edu.ar/',
    'https://intranet/outcome',
    'file:///etc/passwd',
    'not a url',
    '',
    undefined
  ])('rejects %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
  });
});

describe('escapeXml', () => {
  test('neutralizes markup in LTI sourcedIds', () => {
    expect(escapeXml('a</sourcedId><x>&"\'')).toBe('a&lt;/sourcedId&gt;&lt;x&gt;&amp;&quot;&apos;');
    expect(escapeXml(undefined)).toBe('');
  });
});
