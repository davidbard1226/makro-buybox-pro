<?php
// Online TechHub - Order Email Handler
// Place this file at: public_html/order-mail.php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

// Sanitize inputs
function clean($str) {
    return htmlspecialchars(strip_tags(trim($str ?? '')), ENT_QUOTES, 'UTF-8');
}

$fn       = clean($data['firstName'] ?? '');
$ln       = clean($data['lastName'] ?? '');
$email    = filter_var($data['email'] ?? '', FILTER_SANITIZE_EMAIL);
$phone    = clean($data['phone'] ?? '');
$address  = clean($data['address'] ?? '');
$oid      = clean($data['orderId'] ?? '');
$total    = clean($data['total'] ?? '');
$payMethod= clean($data['payMethod'] ?? 'EFT');
$items    = $data['items'] ?? [];

if (!$fn || !$ln || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$oid) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

// Build items table HTML
$itemsHtml = '';
$itemsText = '';
foreach ($items as $item) {
    $name  = clean($item['name'] ?? '');
    $qty   = intval($item['qty'] ?? 1);
    $price = clean($item['price'] ?? '0');
    $line  = 'R' . number_format(floatval($price) * $qty, 0, '.', ',');
    $itemsHtml .= "<tr>
        <td style='padding:8px 12px;border-bottom:1px solid #2a2a2a;font-size:13px;color:#f0f0f0'>{$name}</td>
        <td style='padding:8px 12px;border-bottom:1px solid #2a2a2a;font-size:13px;color:#f0f0f0;text-align:center'>{$qty}</td>
        <td style='padding:8px 12px;border-bottom:1px solid #2a2a2a;font-size:13px;color:#f97316;text-align:right;font-weight:700'>{$line}</td>
    </tr>";
    $itemsText .= "  - {$name} x{$qty} = {$line}\n";
}

// ── CUSTOMER EMAIL ────────────────────────────────────────────────
$customerSubject = "Order Confirmed: {$oid} — Online TechHub";

$customerHtml = "
<!DOCTYPE html>
<html>
<head><meta charset='UTF-8'/><meta name='viewport' content='width=device-width'/></head>
<body style='margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;'>
<table width='100%' cellpadding='0' cellspacing='0' style='background:#0a0a0a;'>
<tr><td align='center' style='padding:30px 20px;'>
<table width='600' cellpadding='0' cellspacing='0' style='max-width:600px;width:100%;'>

  <!-- HEADER -->
  <tr><td style='background:#111;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:3px solid #f97316;text-align:center;'>
    <h1 style='margin:0;font-size:26px;font-weight:700;letter-spacing:2px;color:#f0f0f0;'>Online<span style='color:#f97316;'>TechHub</span></h1>
    <p style='margin:6px 0 0;color:#888;font-size:13px;'>South Africa&rsquo;s Tech Destination</p>
  </td></tr>

  <!-- HERO -->
  <tr><td style='background:#161616;padding:32px;text-align:center;'>
    <div style='font-size:52px;margin-bottom:12px;'>✅</div>
    <h2 style='margin:0 0 8px;color:#f97316;font-size:24px;'>Order Confirmed!</h2>
    <p style='margin:0;color:#888;font-size:14px;line-height:1.6;'>Thank you <strong style='color:#f0f0f0;'>{$fn} {$ln}</strong>! Your order has been received and is awaiting payment.</p>
    <div style='margin:20px auto 0;display:inline-block;background:#1a0e00;border:1px solid #f97316;border-radius:8px;padding:10px 24px;'>
      <p style='margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;'>Order Reference</p>
      <p style='margin:4px 0 0;font-size:20px;font-weight:700;color:#f97316;letter-spacing:2px;'>{$oid}</p>
    </div>
  </td></tr>

  <!-- ITEMS TABLE -->
  <tr><td style='background:#111;padding:24px 32px;'>
    <h3 style='margin:0 0 16px;color:#f0f0f0;font-size:15px;border-bottom:1px solid #2a2a2a;padding-bottom:10px;'>🛒 Your Order</h3>
    <table width='100%' cellpadding='0' cellspacing='0'>
      <tr>
        <th style='padding:8px 12px;background:#1a1a1a;color:#888;font-size:11px;text-transform:uppercase;text-align:left;border-radius:4px 0 0 4px;'>Product</th>
        <th style='padding:8px 12px;background:#1a1a1a;color:#888;font-size:11px;text-transform:uppercase;text-align:center;'>Qty</th>
        <th style='padding:8px 12px;background:#1a1a1a;color:#888;font-size:11px;text-transform:uppercase;text-align:right;border-radius:0 4px 4px 0;'>Amount</th>
      </tr>
      {$itemsHtml}
      <tr>
        <td colspan='2' style='padding:12px 12px 0;color:#888;font-size:13px;'><strong style='color:#f0f0f0;'>TOTAL (incl. VAT)</strong></td>
        <td style='padding:12px 12px 0;text-align:right;font-size:20px;font-weight:700;color:#f97316;'>R{$total}</td>
      </tr>
    </table>
  </td></tr>

  <!-- EFT DETAILS -->
  <tr><td style='background:#161616;padding:24px 32px;'>
    <h3 style='margin:0 0 16px;color:#f0f0f0;font-size:15px;'>🏦 Please Make Payment</h3>
    <table width='100%' cellpadding='0' cellspacing='0' style='background:#111;border-radius:8px;overflow:hidden;'>
      <tr><td style='padding:10px 16px;border-bottom:1px solid #2a2a2a;'><span style='color:#888;font-size:12px;'>Bank</span><br/><strong style='color:#f0f0f0;font-size:14px;'>Capitec Business</strong></td></tr>
      <tr><td style='padding:10px 16px;border-bottom:1px solid #2a2a2a;'><span style='color:#888;font-size:12px;'>Account Name</span><br/><strong style='color:#f0f0f0;font-size:14px;'>ONLINETECHHUB (PTY) LTD</strong></td></tr>
      <tr><td style='padding:10px 16px;border-bottom:1px solid #2a2a2a;'><span style='color:#888;font-size:12px;'>Account Number</span><br/><strong style='color:#f97316;font-size:18px;letter-spacing:2px;'>1055027882</strong></td></tr>
      <tr><td style='padding:10px 16px;border-bottom:1px solid #2a2a2a;'><span style='color:#888;font-size:12px;'>Branch Code</span><br/><strong style='color:#f0f0f0;font-size:14px;'>450105</strong></td></tr>
      <tr><td style='padding:10px 16px;border-bottom:1px solid #2a2a2a;'><span style='color:#888;font-size:12px;'>Account Type</span><br/><strong style='color:#f0f0f0;font-size:14px;'>Business Current</strong></td></tr>
      <tr><td style='padding:10px 16px;border-bottom:1px solid #2a2a2a;'><span style='color:#888;font-size:12px;'>Payment Reference (IMPORTANT)</span><br/><strong style='color:#f97316;font-size:18px;letter-spacing:2px;'>{$oid}</strong></td></tr>
      <tr><td style='padding:10px 16px;'><span style='color:#888;font-size:12px;'>Amount</span><br/><strong style='color:#f97316;font-size:22px;font-weight:700;'>R{$total}</strong></td></tr>
    </table>
    <p style='margin:14px 0 0;color:#888;font-size:12px;line-height:1.6;'>⚠️ <strong style='color:#f0f0f0;'>Important:</strong> Use your Order ID <strong style='color:#f97316;'>{$oid}</strong> as the payment reference. Orders are processed within 2-4 business hours of payment confirmation.</p>
  </td></tr>

  <!-- DELIVERY INFO -->
  <tr><td style='background:#111;padding:20px 32px;'>
    <h3 style='margin:0 0 12px;color:#f0f0f0;font-size:15px;'>📦 Delivery Details</h3>
    <p style='margin:0;color:#888;font-size:13px;line-height:1.8;'><strong style='color:#f0f0f0;'>Name:</strong> {$fn} {$ln}<br/><strong style='color:#f0f0f0;'>Phone:</strong> {$phone}<br/><strong style='color:#f0f0f0;'>Address:</strong> {$address}</p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style='background:#111;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;border-top:1px solid #2a2a2a;'>
    <p style='margin:0 0 8px;color:#888;font-size:12px;'>Questions? Contact us:</p>
    <p style='margin:0;color:#f97316;font-size:13px;'>📧 info@onlinetechhub.co.za &nbsp;|&nbsp; 💬 WhatsApp: 069 691 3518</p>
    <p style='margin:12px 0 0;color:#444;font-size:11px;'>© 2026 Online TechHub (Pty) Ltd &nbsp;·&nbsp; onlinetechhub.co.za</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>";

// ── SELLER NOTIFICATION EMAIL ─────────────────────────────────────
$sellerSubject = "🛒 NEW ORDER {$oid} — R{$total} — Online TechHub";

$sellerHtml = "
<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;background:#0a0a0a;color:#f0f0f0;padding:20px;'>
<div style='max-width:600px;margin:auto;background:#111;border-radius:12px;border:2px solid #f97316;overflow:hidden;'>
  <div style='background:#f97316;padding:20px 28px;'>
    <h1 style='margin:0;color:#fff;font-size:22px;'>🛒 NEW ORDER RECEIVED!</h1>
    <p style='margin:4px 0 0;color:rgba(255,255,255,.8);font-size:14px;'>Order: <strong>{$oid}</strong> &nbsp;|&nbsp; Total: <strong>R{$total}</strong></p>
  </div>
  <div style='padding:24px 28px;'>
    <h3 style='color:#f97316;margin:0 0 12px;'>Customer Details</h3>
    <table style='width:100%;border-collapse:collapse;'>
      <tr><td style='padding:6px 0;color:#888;font-size:13px;width:120px;'>Name</td><td style='padding:6px 0;color:#f0f0f0;font-size:13px;font-weight:700;'>{$fn} {$ln}</td></tr>
      <tr><td style='padding:6px 0;color:#888;font-size:13px;'>Email</td><td style='padding:6px 0;color:#f97316;font-size:13px;'>{$email}</td></tr>
      <tr><td style='padding:6px 0;color:#888;font-size:13px;'>Phone</td><td style='padding:6px 0;color:#f0f0f0;font-size:13px;'>{$phone}</td></tr>
      <tr><td style='padding:6px 0;color:#888;font-size:13px;'>Address</td><td style='padding:6px 0;color:#f0f0f0;font-size:13px;'>{$address}</td></tr>
      <tr><td style='padding:6px 0;color:#888;font-size:13px;'>Payment</td><td style='padding:6px 0;color:#f0f0f0;font-size:13px;'>{$payMethod}</td></tr>
    </table>
    <h3 style='color:#f97316;margin:20px 0 12px;'>Items Ordered</h3>
    <table width='100%' style='border-collapse:collapse;background:#161616;border-radius:8px;overflow:hidden;'>
      <tr style='background:#1a1a1a;'><th style='padding:8px 12px;color:#888;font-size:11px;text-align:left;'>Product</th><th style='padding:8px 12px;color:#888;font-size:11px;text-align:center;'>Qty</th><th style='padding:8px 12px;color:#888;font-size:11px;text-align:right;'>Amount</th></tr>
      {$itemsHtml}
      <tr><td colspan='2' style='padding:10px 12px;color:#888;font-size:13px;'>TOTAL</td><td style='padding:10px 12px;color:#f97316;font-size:18px;font-weight:700;text-align:right;'>R{$total}</td></tr>
    </table>
    <div style='margin-top:20px;background:#1a0e00;border:1px solid #f97316;border-radius:8px;padding:14px 18px;'>
      <p style='margin:0;color:#f97316;font-size:13px;font-weight:700;'>⚡ Action Required: Confirm payment reference <strong>{$oid}</strong> in your Capitec app, then arrange delivery.</p>
    </div>
  </div>
</div>
</body></html>";

// ── SEND EMAILS ───────────────────────────────────────────────────
$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: Online TechHub <noreply@onlinetechhub.co.za>\r\n";
$headers .= "Reply-To: info@onlinetechhub.co.za\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

$sentCustomer = mail($email, $customerSubject, $customerHtml, $headers);
$sentSeller   = mail('orders@onlinetechhub.co.za', $sellerSubject, $sellerHtml, $headers);

echo json_encode([
    'success'       => $sentCustomer || $sentSeller,
    'sentCustomer'  => $sentCustomer,
    'sentSeller'    => $sentSeller,
    'orderId'       => $oid
]);
