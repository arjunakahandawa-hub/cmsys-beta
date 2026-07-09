<?php
/**
 * NCW-PS Configuration File
 * Naval Civil Works Productivity Suite v2.2
 * Dual Firebase Architecture
 */

// Error reporting (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// =============================================
// FIREBASE DB #1 — Sailors / Personnel (READ ONLY)
// Project: ce-admin-panel2025
// =============================================
define('FB1_PROJECT_ID',    'ce-admin-panel2025');
define('FB1_API_KEY',       'AIzaSyDmHdg1FfgR_-4pKJ5z0inI8-BZ21MUtvg');
define('FB1_DB_URL',        'https://ce-admin-panel2025-default-rtdb.firebaseio.com');
define('FB1_AUTH_DOMAIN',   'ce-admin-panel2025.firebaseapp.com');

// =============================================
// FIREBASE DB #2 — NCW-PS Operations (READ + WRITE)
// Project: ncw-ps-operations
// =============================================
define('FB2_PROJECT_ID',    'ncw-ps-operations');
define('FB2_API_KEY',       'AIzaSyCRgW9qcd42Ks_C56csNL85jXd5OsLD8q0');
define('FB2_DB_URL',        'https://ncw-ps-operations-default-rtdb.asia-southeast1.firebasedatabase.app');
define('FB2_AUTH_DOMAIN',   'ncw-ps-operations.firebaseapp.com');

// =============================================
// Application Settings
// =============================================
define('APP_NAME',    'NCW-PS');
define('APP_VERSION', '2.2.0');
define('TIMEZONE',    'Asia/Colombo');

date_default_timezone_set(TIMEZONE);

// =============================================
// Helper: Read from Firebase REST API (GET)
// Used by api.php to fetch sailors from DB #1
// =============================================
function firebaseGet($dbUrl, $path, $apiKey = null) {
    $url = rtrim($dbUrl, '/') . '/' . ltrim($path, '/') . '.json';
    if ($apiKey) $url .= '?auth=' . $apiKey;

    $ctx = stream_context_create(['http' => [
        'method'  => 'GET',
        'timeout' => 10,
        'header'  => 'Content-Type: application/json',
    ]]);
    $response = @file_get_contents($url, false, $ctx);
    return $response ? json_decode($response, true) : null;
}

// =============================================
// Helper: Write to Firebase REST API (PUT/PATCH)
// Available for server-side use if needed
// =============================================
function firebasePut($dbUrl, $path, $data, $apiKey = null) {
    $url = rtrim($dbUrl, '/') . '/' . ltrim($path, '/') . '.json';
    if ($apiKey) $url .= '?auth=' . $apiKey;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS    => json_encode($data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER    => ['Content-Type: application/json'],
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

// =============================================
// Helper: JSON response
// =============================================
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    echo json_encode($data);
    exit;
}

function sanitizeInput($data) {
    return htmlspecialchars(strip_tags(trim($data)));
}

function getCurrentDateTime() {
    return date('Y-m-d H:i:s');
}
?>

