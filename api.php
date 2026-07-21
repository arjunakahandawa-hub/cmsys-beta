<?php
/**
 * NCW-PS API Endpoints
 * Naval Civil Works Productivity Suite
 */

require_once 'config.php';

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    exit(0);
}

$db = Database::getInstance()->getConnection();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {
    // ==================== JOB CARDS ====================
    case 'job_cards':
        if ($method === 'GET') {
            $jobId = $_GET['job_id'] ?? null;
            if ($jobId) {
                $stmt = $db->prepare("SELECT * FROM job_cards WHERE id = ?");
                $stmt->execute([$jobId]);
                jsonResponse(['success' => true, 'data' => $stmt->fetch()]);
            } else {
                $stmt = $db->query("SELECT jc.*, wo.description as work_order_desc 
                    FROM job_cards jc 
                    LEFT JOIN work_orders wo ON jc.work_order_id = wo.id 
                    ORDER BY jc.created_at DESC");
                jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
            }
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO job_cards 
                (job_number, work_order_id, zone_id, description, location, start_date, status, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)");
            $jobNumber = 'JC/' . date('Y') . '/' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
            $stmt->execute([
                $jobNumber,
                $input['work_order_id'],
                $input['zone_id'],
                $input['description'],
                $input['location'],
                $input['start_date'] ?? date('Y-m-d'),
                $input['created_by'] ?? 1
            ]);
            $id = $db->lastInsertId();
            
            // Sync to Firebase
            syncToFirebase('job_cards', $id, array_merge($input, ['id' => $id, 'job_number' => $jobNumber]));
            
            jsonResponse(['success' => true, 'id' => $id, 'job_number' => $jobNumber]);
        }
        break;

    // ==================== JOB CARD MATERIALS ====================
    case 'job_card_materials':
        if ($method === 'GET') {
            $jobCardId = $_GET['job_card_id'] ?? null;
            $stmt = $db->prepare("SELECT * FROM job_card_materials WHERE job_card_id = ? ORDER BY logged_at DESC");
            $stmt->execute([$jobCardId]);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO job_card_materials 
                (job_card_id, material_id, material_name, quantity, unit, cost_per_unit, total_cost, logged_by, logged_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");
            $totalCost = $input['quantity'] * $input['cost_per_unit'];
            $stmt->execute([
                $input['job_card_id'],
                $input['material_id'] ?? null,
                $input['material_name'],
                $input['quantity'],
                $input['unit'],
                $input['cost_per_unit'],
                $totalCost,
                $input['logged_by'] ?? 1
            ]);
            
            // Update inventory
            if ($input['material_id']) {
                $db->prepare("UPDATE inventory SET quantity = quantity - ? WHERE id = ?")
                   ->execute([$input['quantity'], $input['material_id']]);
            }
            
            syncToFirebase('job_card_materials', $db->lastInsertId(), $input);
            jsonResponse(['success' => true, 'id' => $db->lastInsertId(), 'total_cost' => $totalCost]);
        }
        break;

    // ==================== JOB CARD LABOR ====================
    case 'job_card_labor':
        if ($method === 'GET') {
            $jobCardId = $_GET['job_card_id'] ?? null;
            $stmt = $db->prepare("SELECT jcl.*, u.name as sailor_name, u.trade 
                FROM job_card_labor jcl 
                LEFT JOIN users u ON jcl.sailor_id = u.id 
                WHERE jcl.job_card_id = ? ORDER BY jcl.work_date DESC");
            $stmt->execute([$jobCardId]);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO job_card_labor 
                (job_card_id, sailor_id, work_date, hours_worked, role, logged_by) 
                VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $input['job_card_id'],
                $input['sailor_id'],
                $input['work_date'] ?? date('Y-m-d'),
                $input['hours_worked'] ?? 8,
                $input['role'] ?? 'Worker',
                $input['logged_by'] ?? 1
            ]);
            
            syncToFirebase('job_card_labor', $db->lastInsertId(), $input);
            jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);
        }
        break;

    // ==================== USER FEEDBACK ====================
    case 'user_feedback':
        if ($method === 'GET') {
            $jobNumber = $_GET['job_number'] ?? null;
            if ($jobNumber) {
                $stmt = $db->prepare("SELECT * FROM user_feedback WHERE job_number = ?");
                $stmt->execute([$jobNumber]);
                jsonResponse(['success' => true, 'data' => $stmt->fetch()]);
            } else {
                $stmt = $db->query("SELECT * FROM user_feedback ORDER BY submitted_at DESC");
                jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
            }
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO user_feedback 
                (job_number, job_card_id, productivity_score, workmanship_score, communication_score, 
                professionalism_score, satisfaction_score, overall_score, comments, submitted_by, submitted_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
            $overallScore = round(($input['productivity_score'] + $input['workmanship_score'] + 
                $input['communication_score'] + $input['professionalism_score'] + 
                $input['satisfaction_score']) / 5, 2);
            $stmt->execute([
                $input['job_number'],
                $input['job_card_id'] ?? null,
                $input['productivity_score'],
                $input['workmanship_score'],
                $input['communication_score'],
                $input['professionalism_score'],
                $input['satisfaction_score'],
                $overallScore,
                $input['comments'] ?? '',
                $input['submitted_by'] ?? 'End User'
            ]);
            
            syncToFirebase('user_feedback', $db->lastInsertId(), array_merge($input, ['overall_score' => $overallScore]));
            jsonResponse(['success' => true, 'id' => $db->lastInsertId(), 'overall_score' => $overallScore]);
        }
        break;

    // ==================== INVENTORY ====================
    case 'inventory':
        if ($method === 'GET') {
            $category = $_GET['category'] ?? null;
            $location = $_GET['location'] ?? null;
            
            $sql = "SELECT * FROM inventory WHERE 1=1";
            $params = [];
            
            if ($category && $category !== 'all') {
                $sql .= " AND category = ?";
                $params[] = $category;
            }
            if ($location) {
                $sql .= " AND location = ?";
                $params[] = $location;
            }
            $sql .= " ORDER BY category, description, cost_per_unit DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO inventory 
                (type, description, deno, quantity, cost_per_unit, requirement, on_charge_ref, off_charge_ref, 
                location, book_no, min_stock_level, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([
                $input['type'] ?? 'material',
                $input['description'],
                $input['deno'],
                $input['quantity'],
                $input['cost_per_unit'],
                $input['requirement'] ?? null,
                $input['on_charge_ref'] ?? null,
                $input['off_charge_ref'] ?? null,
                $input['location'] ?? 'Zone Store',
                $input['book_no'] ?? null,
                $input['min_stock_level'] ?? 0
            ]);
            
            syncToFirebase('inventory', $db->lastInsertId(), $input);
            jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);
        } elseif ($method === 'PUT') {
            $stmt = $db->prepare("UPDATE inventory SET 
                description = ?, deno = ?, quantity = ?, cost_per_unit = ?, 
                requirement = ?, on_charge_ref = ?, off_charge_ref = ?, location = ?, book_no = ? 
                WHERE id = ?");
            $stmt->execute([
                $input['description'],
                $input['deno'],
                $input['quantity'],
                $input['cost_per_unit'],
                $input['requirement'] ?? null,
                $input['on_charge_ref'] ?? null,
                $input['off_charge_ref'] ?? null,
                $input['location'] ?? 'Zone Store',
                $input['book_no'] ?? null,
                $input['id']
            ]);
            
            syncToFirebase('inventory', $input['id'], $input);
            jsonResponse(['success' => true]);
        }
        break;

    // ==================== BULK INVENTORY UPLOAD ====================
    case 'inventory_bulk':
        if ($method === 'POST') {
            $items = $input['items'] ?? [];
            $inserted = 0;
            foreach ($items as $item) {
                $stmt = $db->prepare("INSERT INTO inventory 
                    (type, description, deno, quantity, cost_per_unit, requirement, on_charge_ref, location, book_no, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
                $stmt->execute([
                    $item['type'] ?? 'material',
                    $item['description'],
                    $item['deno'],
                    $item['quantity'],
                    $item['cost_per_unit'],
                    $item['requirement'] ?? null,
                    $item['on_charge_ref'] ?? null,
                    $item['location'] ?? 'Zone Store',
                    $item['book_no'] ?? null
                ]);
                $inserted++;
            }
            jsonResponse(['success' => true, 'inserted' => $inserted]);
        }
        break;

    // ==================== ESTIMATES ====================
    case 'estimates':
        if ($method === 'GET') {
            $estimateId = $_GET['estimate_id'] ?? null;
            if ($estimateId) {
                $stmt = $db->prepare("SELECT * FROM estimates WHERE id = ?");
                $stmt->execute([$estimateId]);
                $estimate = $stmt->fetch();
                
                $itemsStmt = $db->prepare("SELECT * FROM estimate_items WHERE estimate_id = ?");
                $itemsStmt->execute([$estimateId]);
                $estimate['items'] = $itemsStmt->fetchAll();
                
                jsonResponse(['success' => true, 'data' => $estimate]);
            } else {
                $stmt = $db->query("SELECT * FROM estimates ORDER BY created_at DESC");
                jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
            }
        } elseif ($method === 'POST') {
            $estimateNo = 'EST/' . date('Y') . '/' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
            $stmt = $db->prepare("INSERT INTO estimates 
                (estimate_number, description, reference_doc, total_cost, status, created_by, created_at) 
                VALUES (?, ?, ?, ?, 'Pending', ?, NOW())");
            $stmt->execute([
                $estimateNo,
                $input['description'],
                $input['reference_doc'] ?? null,
                $input['total_cost'] ?? 0,
                $input['created_by'] ?? 1
            ]);
            $estimateId = $db->lastInsertId();
            
            // Insert estimate items
            if (isset($input['items']) && is_array($input['items'])) {
                foreach ($input['items'] as $item) {
                    $db->prepare("INSERT INTO estimate_items 
                        (estimate_id, material_id, description, quantity, unit, unit_cost, total_cost, availability) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                        ->execute([
                            $estimateId,
                            $item['material_id'] ?? null,
                            $item['description'],
                            $item['quantity'],
                            $item['unit'],
                            $item['unit_cost'],
                            $item['quantity'] * $item['unit_cost'],
                            $item['availability'] ?? 'Unknown'
                        ]);
                }
            }
            
            syncToFirebase('estimates', $estimateId, array_merge($input, ['estimate_number' => $estimateNo]));
            jsonResponse(['success' => true, 'id' => $estimateId, 'estimate_number' => $estimateNo]);
        } elseif ($method === 'PUT') {
            $stmt = $db->prepare("UPDATE estimates SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?");
            $stmt->execute([$input['status'], $input['approved_by'] ?? null, $input['id']]);
            
            syncToFirebase('estimates', $input['id'], $input);
            jsonResponse(['success' => true]);
        }
        break;

    // ==================== LOCATIONS ====================
    case 'locations':
        if ($method === 'GET') {
            $stmt = $db->query("SELECT * FROM locations ORDER BY zone_id, building_name");
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO locations 
                (zone_id, building_name, sub_location, description, created_at) 
                VALUES (?, ?, ?, ?, NOW())");
            $stmt->execute([
                $input['zone_id'],
                $input['building_name'],
                $input['sub_location'] ?? null,
                $input['description'] ?? null
            ]);
            
            syncToFirebase('locations', $db->lastInsertId(), $input);
            jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);
        }
        break;

    // ==================== LOCATIONS BULK UPLOAD ====================
    case 'locations_bulk':
        if ($method === 'POST') {
            $items = $input['items'] ?? [];
            $inserted = 0;
            foreach ($items as $item) {
                $stmt = $db->prepare("INSERT INTO locations 
                    (zone_id, building_name, sub_location, description, created_at) 
                    VALUES (?, ?, ?, ?, NOW())");
                $stmt->execute([
                    $item['zone_id'],
                    $item['building_name'],
                    $item['sub_location'] ?? null,
                    $item['description'] ?? null
                ]);
                $inserted++;
            }
            jsonResponse(['success' => true, 'inserted' => $inserted]);
        }
        break;

    // ==================== MAINTENANCE RECORDS ====================
    case 'maintenance_records':
        if ($method === 'GET') {
            $locationId = $_GET['location_id'] ?? null;
            if ($locationId) {
                $stmt = $db->prepare("SELECT mr.*, jc.job_number, l.building_name 
                    FROM maintenance_records mr 
                    LEFT JOIN job_cards jc ON mr.job_card_id = jc.id 
                    LEFT JOIN locations l ON mr.location_id = l.id 
                    WHERE mr.location_id = ? ORDER BY mr.maintenance_date DESC");
                $stmt->execute([$locationId]);
            } else {
                $stmt = $db->query("SELECT mr.*, jc.job_number, l.building_name, l.zone_id 
                    FROM maintenance_records mr 
                    LEFT JOIN job_cards jc ON mr.job_card_id = jc.id 
                    LEFT JOIN locations l ON mr.location_id = l.id 
                    ORDER BY mr.maintenance_date DESC");
            }
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO maintenance_records 
                (location_id, job_card_id, maintenance_type, description, maintenance_date, performed_by) 
                VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $input['location_id'],
                $input['job_card_id'] ?? null,
                $input['maintenance_type'],
                $input['description'],
                $input['maintenance_date'] ?? date('Y-m-d'),
                $input['performed_by'] ?? null
            ]);
            
            syncToFirebase('maintenance_records', $db->lastInsertId(), $input);
            jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);
        }
        break;

    // ==================== WORK ORDERS ====================
    case 'work_orders':
        if ($method === 'GET') {
            $zoneId = $_GET['zone_id'] ?? null;
            $status = $_GET['status'] ?? null;
            
            $sql = "SELECT wo.*, l.building_name as location_name 
                FROM work_orders wo 
                LEFT JOIN locations l ON wo.location_id = l.id 
                WHERE 1=1";
            $params = [];
            
            if ($zoneId) {
                $sql .= " AND wo.zone_id = ?";
                $params[] = $zoneId;
            }
            if ($status) {
                $sql .= " AND wo.status = ?";
                $params[] = $status;
            }
            $sql .= " ORDER BY wo.priority DESC, wo.created_at DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO work_orders 
                (zone_id, type, reference_no, reference_type, description, status, priority, 
                estimated_duration, budget_allocation, authority_approval, incharge_id, supervisor_id, 
                location_id, progress_percentage, created_by, created_at) 
                VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())");
            $stmt->execute([
                $input['zone_id'],
                $input['type'],
                $input['reference_no'] ?? null,
                $input['reference_type'] ?? null,
                $input['description'],
                $input['priority'] ?? 'Medium',
                $input['estimated_duration'] ?? null,
                $input['budget_allocation'] ?? null,
                $input['authority_approval'] ?? null,
                $input['incharge_id'] ?? null,
                $input['supervisor_id'] ?? null,
                $input['location_id'] ?? null,
                $input['created_by'] ?? 1
            ]);
            
            $id = $db->lastInsertId();
            syncToFirebase('work_orders', $id, $input);
            jsonResponse(['success' => true, 'id' => $id]);
        } elseif ($method === 'PUT') {
            $stmt = $db->prepare("UPDATE work_orders SET 
                status = ?, progress_percentage = ?, updated_at = NOW() 
                WHERE id = ?");
            $stmt->execute([
                $input['status'] ?? 'Active',
                $input['progress_percentage'] ?? 0,
                $input['id']
            ]);
            
            syncToFirebase('work_orders', $input['id'], $input);
            jsonResponse(['success' => true]);
        }
        break;

    // ==================== ZONE TEAMS ====================
    case 'zone_teams':
        if ($method === 'GET') {
            $zoneId = $_GET['zone_id'] ?? null;
            if ($zoneId) {
                $stmt = $db->prepare("SELECT zt.*, u.name, u.trade, u.rank,
                    (SELECT AVG((quality_score + efficiency_score + discipline_score + material_score + 
                    attitude_score + skill_score) / 6) FROM daily_evaluations WHERE sailor_id = zt.sailor_id) as avg_score
                    FROM zone_teams zt 
                    LEFT JOIN users u ON zt.sailor_id = u.id 
                    WHERE zt.zone_id = ? AND zt.status = 'Active'
                    ORDER BY avg_score DESC");
                $stmt->execute([$zoneId]);
                jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
            }
        } elseif ($method === 'POST') {
            // Check zone team limit (15 members)
            $countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM zone_teams WHERE zone_id = ? AND status = 'Active'");
            $countStmt->execute([$input['zone_id']]);
            $count = $countStmt->fetch()['cnt'];
            
            if ($count >= 15) {
                jsonResponse(['success' => false, 'error' => 'Zone team limit reached (max 15 members)'], 400);
            }
            
            $stmt = $db->prepare("INSERT INTO zone_teams (zone_id, sailor_id, assigned_by, assigned_at, status) 
                VALUES (?, ?, ?, NOW(), 'Active')");
            $stmt->execute([
                $input['zone_id'],
                $input['sailor_id'],
                $input['assigned_by'] ?? 1
            ]);
            
            syncToFirebase('zone_teams', $db->lastInsertId(), $input);
            jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);
        } elseif ($method === 'DELETE') {
            $stmt = $db->prepare("UPDATE zone_teams SET status = 'Inactive' WHERE id = ?");
            $stmt->execute([$input['id']]);
            jsonResponse(['success' => true]);
        }
        break;

    // ==================== DAILY EVALUATIONS (Extended 1-10) ====================
    case 'daily_evaluations':
        if ($method === 'GET') {
            $sailorId = $_GET['sailor_id'] ?? null;
            $date = $_GET['date'] ?? null;
            
            $sql = "SELECT de.*, u.name as sailor_name, wo.description as work_order_desc 
                FROM daily_evaluations de 
                LEFT JOIN users u ON de.sailor_id = u.id 
                LEFT JOIN work_orders wo ON de.work_order_id = wo.id 
                WHERE 1=1";
            $params = [];
            
            if ($sailorId) {
                $sql .= " AND de.sailor_id = ?";
                $params[] = $sailorId;
            }
            if ($date) {
                $sql .= " AND de.date = ?";
                $params[] = $date;
            }
            $sql .= " ORDER BY de.evaluated_at DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        } elseif ($method === 'POST') {
            $stmt = $db->prepare("INSERT INTO daily_evaluations 
                (date, sailor_id, supervisor_id, work_order_id, job_card_id,
                quality_score, efficiency_score, discipline_score, material_score, 
                attitude_score, skill_score, comment, score_1_reason, score_2_reason, score_10_reason, evaluated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([
                $input['date'] ?? date('Y-m-d'),
                $input['sailor_id'],
                $input['supervisor_id'],
                $input['work_order_id'] ?? null,
                $input['job_card_id'] ?? null,
                $input['quality_score'],
                $input['efficiency_score'],
                $input['discipline_score'],
                $input['material_score'],
                $input['attitude_score'] ?? 5,
                $input['skill_score'] ?? 5,
                $input['comment'] ?? '',
                $input['score_1_reason'] ?? null,
                $input['score_2_reason'] ?? null,
                $input['score_10_reason'] ?? null
            ]);
            
            $id = $db->lastInsertId();
            
            // Update sailor's cumulative score
            $avgStmt = $db->prepare("SELECT AVG((quality_score + efficiency_score + discipline_score + 
                material_score + attitude_score + skill_score) / 6) as avg_score 
                FROM daily_evaluations WHERE sailor_id = ?");
            $avgStmt->execute([$input['sailor_id']]);
            $avgScore = $avgStmt->fetch()['avg_score'];
            
            $db->prepare("UPDATE users SET performance_score = ? WHERE id = ?")
               ->execute([$avgScore, $input['sailor_id']]);
            
            syncToFirebase('daily_evaluations', $id, $input);
            jsonResponse(['success' => true, 'id' => $id, 'avg_score' => $avgScore]);
        }
        break;

    // ==================== USERS/SAILORS ====================
    case 'users':
        if ($method === 'GET') {
            $zoneId = $_GET['zone_id'] ?? null;
            $status = $_GET['status'] ?? 'Active';
            
            $sql = "SELECT u.*, 
                (SELECT AVG((quality_score + efficiency_score + discipline_score + material_score + 
                attitude_score + skill_score) / 6) FROM daily_evaluations WHERE sailor_id = u.id) as performance_score
                FROM users u WHERE u.status = ?";
            $params = [$status];
            
            if ($zoneId) {
                $sql .= " AND u.zone_assigned = ?";
                $params[] = $zoneId;
            }
            $sql .= " ORDER BY performance_score DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        }
        break;

    // ==================== DAILY ALLOCATIONS ====================
    case 'daily_allocations':
        if ($method === 'GET') {
            $date = $_GET['date'] ?? date('Y-m-d');
            $zoneId = $_GET['zone_id'] ?? null;
            
            $sql = "SELECT da.*, u.name as sailor_name, u.trade, u.rank, wo.description as work_order_desc,
                (SELECT AVG((quality_score + efficiency_score + discipline_score + material_score + 
                attitude_score + skill_score) / 6) FROM daily_evaluations WHERE sailor_id = da.sailor_id) as performance_score
                FROM daily_allocations da 
                LEFT JOIN users u ON da.sailor_id = u.id 
                LEFT JOIN work_orders wo ON da.work_order_id = wo.id 
                WHERE da.date = ?";
            $params = [$date];
            
            if ($zoneId) {
                $sql .= " AND wo.zone_id = ?";
                $params[] = $zoneId;
            }
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        } elseif ($method === 'POST') {
            // Check for continuation from previous day
            if ($input['continuation'] ?? false) {
                $prevDate = date('Y-m-d', strtotime($input['date'] . ' -1 day'));
                $prevStmt = $db->prepare("SELECT * FROM daily_allocations 
                    WHERE date = ? AND work_order_id = ? AND status != 'Completed'");
                $prevStmt->execute([$prevDate, $input['work_order_id']]);
                $prevAllocations = $prevStmt->fetchAll();
                
                foreach ($prevAllocations as $prev) {
                    $db->prepare("INSERT INTO daily_allocations 
                        (date, sailor_id, work_order_id, role_today, assigned_by, status, is_continuation) 
                        VALUES (?, ?, ?, ?, ?, 'Active', 1)")
                        ->execute([
                            $input['date'],
                            $prev['sailor_id'],
                            $prev['work_order_id'],
                            $prev['role_today'],
                            $input['assigned_by'] ?? 1
                        ]);
                }
                jsonResponse(['success' => true, 'continued' => count($prevAllocations)]);
            } else {
                $stmt = $db->prepare("INSERT INTO daily_allocations 
                    (date, sailor_id, work_order_id, role_today, assigned_by, status, is_continuation) 
                    VALUES (?, ?, ?, ?, ?, 'Active', 0)
                    ON DUPLICATE KEY UPDATE work_order_id = VALUES(work_order_id), role_today = VALUES(role_today)");
                $stmt->execute([
                    $input['date'] ?? date('Y-m-d'),
                    $input['sailor_id'],
                    $input['work_order_id'],
                    $input['role_today'] ?? 'Worker',
                    $input['assigned_by'] ?? 1
                ]);
                
                syncToFirebase('daily_allocations', $db->lastInsertId(), $input);
                jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);
            }
        }
        break;

    // ==================== GENERATE FEEDBACK LINK ====================
    case 'generate_feedback_link':
        if ($method === 'POST') {
            $jobNumber = $input['job_number'];
            $token = bin2hex(random_bytes(16));
            
            $stmt = $db->prepare("INSERT INTO feedback_tokens (job_number, token, expires_at, created_at) 
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())");
            $stmt->execute([$jobNumber, $token]);
            
            $feedbackLink = "feedback.php?token=" . $token;
            jsonResponse(['success' => true, 'link' => $feedbackLink, 'token' => $token]);
        }
        break;

    // ==================== REPORTS ====================
    case 'reports':
        $reportType = $_GET['type'] ?? 'daily_state';
        
        switch ($reportType) {
            case 'job_card_summary':
                $jobCardId = $_GET['job_card_id'];
                $stmt = $db->prepare("SELECT jc.*, 
                    (SELECT SUM(total_cost) FROM job_card_materials WHERE job_card_id = jc.id) as total_material_cost,
                    (SELECT COUNT(*) FROM job_card_labor WHERE job_card_id = jc.id) as total_labor_entries
                    FROM job_cards jc WHERE jc.id = ?");
                $stmt->execute([$jobCardId]);
                $jobCard = $stmt->fetch();
                
                $materialsStmt = $db->prepare("SELECT * FROM job_card_materials WHERE job_card_id = ?");
                $materialsStmt->execute([$jobCardId]);
                $jobCard['materials'] = $materialsStmt->fetchAll();
                
                $laborStmt = $db->prepare("SELECT jcl.*, u.name, u.trade FROM job_card_labor jcl 
                    LEFT JOIN users u ON jcl.sailor_id = u.id WHERE jcl.job_card_id = ?");
                $laborStmt->execute([$jobCardId]);
                $jobCard['labor'] = $laborStmt->fetchAll();
                
                jsonResponse(['success' => true, 'data' => $jobCard]);
                break;
                
            case 'daily_state':
                $date = $_GET['date'] ?? date('Y-m-d');
                $zoneId = $_GET['zone_id'] ?? null;
                
                $sql = "SELECT u.trade, 
                    COUNT(*) as strength,
                    SUM(CASE WHEN da.status = 'Active' THEN 1 ELSE 0 END) as deployed
                    FROM users u 
                    LEFT JOIN daily_allocations da ON u.id = da.sailor_id AND da.date = ?
                    WHERE u.status = 'Active'";
                $params = [$date];
                
                if ($zoneId) {
                    $sql .= " AND u.zone_assigned = ?";
                    $params[] = $zoneId;
                }
                $sql .= " GROUP BY u.trade";
                
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
                break;
        }
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}
?>
