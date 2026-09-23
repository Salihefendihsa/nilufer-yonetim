import 'package:flutter_test/flutter_test.dart';
import 'package:nilufer_mobile/core/mime_types.dart';

void main() {
  test('resim uzantıları image/* döner (backend upload filtresi)', () {
    expect(mimeTypeForFileName('foto.JPG'), 'image/jpeg');
    expect(mimeTypeForFileName('a.b.png'), 'image/png');
    expect(mimeTypeForFileName('x.webp'), 'image/webp');
  });

  test('belge ve dışa aktarım uzantıları', () {
    expect(mimeTypeForFileName('sozlesme.pdf'), 'application/pdf');
    expect(
      mimeTypeForFileName('odemeler.xlsx'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mimeTypeForFileName('is-programim.ics'), 'text/calendar');
  });

  test('uzantısız/bilinmeyen ad octet-stream döner', () {
    expect(mimeTypeForFileName('blob'), 'application/octet-stream');
    expect(mimeTypeForFileName('x.zzz'), 'application/octet-stream');
  });
}
