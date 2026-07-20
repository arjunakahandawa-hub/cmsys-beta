<?php
$dir = new RecursiveDirectoryIterator('C:/xampp/htdocs/civilpanel/New_Admin_Project');
$ite = new RecursiveIteratorIterator($dir);
foreach($ite as $file) {
    if ($file->isFile() && $file->getExtension() === 'html' || $file->getExtension() === 'js' || $file->getExtension() === 'php') {
        $content = file_get_contents($file->getPathname());
        if (stripos($content, 'VAS LEAVE') !== false) {
            echo "Found in: " . $file->getPathname() . "\n";
        }
    }
}
echo "Done.\n";
?>
