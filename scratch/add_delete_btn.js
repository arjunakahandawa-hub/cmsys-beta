const fs = require('fs');
const path = require('path');

const filePath = 'c:/xampp/htdocs/civilpanel/New_Admin_Project/zone/index.html';
let content = fs.readFileSync(filePath, 'utf8');

const target = `<button onclick="approveEstimate()" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm" id="approveEstimateBtn">
                                        ✅ Approve
                                    </button>`;

if (content.includes(target)) {
    console.log('Target found!');
    const replacement = target + `\n                                    <button onclick="deleteEstimate()" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm" id="deleteEstimateBtn" style="display: none;">
                                        🗑️ Delete
                                    </button>`;
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully inserted Delete button in index.html!');
} else {
    // Try with different spacing
    console.log('Target with original spacing not found. Trying flexible regex replace...');
    const regex = /(<button[^>]*id="approveEstimateBtn"[^>]*>[\s\S]*?<\/button>)/;
    if (regex.test(content)) {
        content = content.replace(regex, `$1\n                                    <button onclick="deleteEstimate()" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm" id="deleteEstimateBtn" style="display: none;">\n                                        🗑️ Delete\n                                    </button>`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully regex-inserted Delete button in index.html!');
    } else {
        console.error('Error: Could not find approveEstimateBtn in index.html');
    }
}
