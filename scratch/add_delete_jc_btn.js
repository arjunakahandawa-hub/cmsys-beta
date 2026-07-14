const fs = require('fs');

const filePath = 'c:/xampp/htdocs/civilpanel/New_Admin_Project/zone/index.html';
let content = fs.readFileSync(filePath, 'utf8');

const target = `<div class="text-right">
                                    <p class="text-sm text-blue-200">Total Material Cost</p>
                                    <p class="text-2xl font-bold" id="totalMaterialCost">Rs. 0.00</p>
                                </div>`;

if (content.includes(target)) {
    const replacement = `<div class="flex items-center gap-4">
                                    <div class="text-right">
                                        <p class="text-sm text-blue-200">Total Material Cost</p>
                                        <p class="text-2xl font-bold" id="totalMaterialCost">Rs. 0.00</p>
                                    </div>
                                    <button onclick="deleteJobCard()" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium" id="deleteJobCardBtn" style="display: none;">
                                        🗑️ Delete
                                    </button>
                                </div>`;
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully inserted Delete Job Card button in index.html!');
} else {
    // Try flex matching
    console.log('Target not found with exact spacing. Trying regex replace...');
    const regex = /(<div class="text-right">\s*<p class="text-sm text-blue-200">Total Material Cost<\/p>\s*<p class="text-2xl font-bold" id="totalMaterialCost">Rs\. 0\.00<\/p>\s*<\/div>)/;
    if (regex.test(content)) {
        content = content.replace(regex, `<div class="flex items-center gap-4">
                                    $1
                                    <button onclick="deleteJobCard()" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium" id="deleteJobCardBtn" style="display: none;">
                                        🗑️ Delete
                                    </button>
                                </div>`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully regex-inserted Delete Job Card button in index.html!');
    } else {
        console.error('Error: Could not find Total Material Cost block in index.html');
    }
}
