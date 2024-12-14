<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$file = '../data/students.json';
$data = json_decode(file_get_contents('php://input'), true);

if (file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT))) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save data']);
}
?>
