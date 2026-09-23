/// Dosya adının uzantısından MIME tipi — yüklemede multipart contentType
/// (backend `lib/upload.ts` filtreleriyle eşleşir) ve web indirmesinde Blob
/// tipi için ortak tablo.
String mimeTypeForFileName(String fileName) {
  final dot = fileName.lastIndexOf('.');
  final ext = dot < 0 ? '' : fileName.substring(dot + 1).toLowerCase();
  return switch (ext) {
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    'heic' => 'image/heic',
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' =>
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel',
    'xlsx' =>
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt' => 'text/plain',
    'json' => 'application/json',
    'ics' => 'text/calendar',
    _ => 'application/octet-stream',
  };
}
