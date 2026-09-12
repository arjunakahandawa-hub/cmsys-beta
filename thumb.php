<?php
$img_name = isset($_GET['img']) ? $_GET['img'] : (isset($_GET['src']) ? $_GET['src'] : '');
$w = isset($_GET['w']) ? (int)$_GET['w'] : 150;
$h = isset($_GET['h']) ? (int)$_GET['h'] : 150;

if (empty($img_name)) {
    http_response_code(400);
    die("No image specified.");
}

// Security: Prevent directory traversal
$img_name = basename($img_name);
$source_path = __DIR__ . '/images/' . $img_name;

if (!file_exists($source_path) || is_dir($source_path)) {
    $clean_base = pathinfo($img_name, PATHINFO_FILENAME);
    $found = false;
    foreach (['JPG', 'jpg', 'png', 'PNG', 'jpeg', 'JPEG'] as $ext_test) {
        $test_path = __DIR__ . '/images/' . $clean_base . '.' . $ext_test;
        if (file_exists($test_path) && !is_dir($test_path)) {
            $source_path = $test_path;
            $found = true;
            break;
        }
    }
    if (!$found) {
        http_response_code(404);
        die("Image not found.");
    }
}

$ext = strtolower(pathinfo($source_path, PATHINFO_EXTENSION));
if (!in_array($ext, ['jpg', 'jpeg', 'png'])) {
    http_response_code(400);
    die("Invalid image type.");
}

$content_type = ($ext === 'png') ? 'image/png' : 'image/jpeg';

// If GD extension is not loaded or missing, serve original image directly
if (!extension_loaded('gd') || !function_exists('imagecreatetruecolor')) {
    header('Content-Type: ' . $content_type);
    header('Content-Length: ' . filesize($source_path));
    header('Cache-Control: public, max-age=86400');
    readfile($source_path);
    exit;
}

list($orig_w, $orig_h) = @getimagesize($source_path);
if (!$orig_w || !$orig_h) {
    header('Content-Type: ' . $content_type);
    readfile($source_path);
    exit;
}

$ratio = min($w / $orig_w, $h / $orig_h);
$new_w = max(1, (int)round($orig_w * $ratio));
$new_h = max(1, (int)round($orig_h * $ratio));

$thumb = @imagecreatetruecolor($new_w, $new_h);
if (!$thumb) {
    header('Content-Type: ' . $content_type);
    readfile($source_path);
    exit;
}

if ($ext === 'png') {
    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=86400');
    imagealphablending($thumb, false);
    imagesavealpha($thumb, true);
    $source_img = @imagecreatefrompng($source_path);
    if ($source_img) {
        imagecopyresampled($thumb, $source_img, 0, 0, 0, 0, $new_w, $new_h, $orig_w, $orig_h);
        imagepng($thumb);
        imagedestroy($source_img);
        imagedestroy($thumb);
        exit;
    }
} else {
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=86400');
    $source_img = @imagecreatefromjpeg($source_path);
    if ($source_img) {
        imagecopyresampled($thumb, $source_img, 0, 0, 0, 0, $new_w, $new_h, $orig_w, $orig_h);
        imagejpeg($thumb, null, 80);
        imagedestroy($source_img);
        imagedestroy($thumb);
        exit;
    }
}

imagedestroy($thumb);
header('Content-Type: ' . $content_type);
readfile($source_path);
exit;
