// The ways a customer can pay through Paystack in Ghana, drawn as small
// badges in each brand's colours. Swap a badge for the official artwork
// when the owner supplies it.

function Visa() {
  return <svg viewBox="0 0 60 38" role="img" aria-label="Visa">
    <rect width="60" height="38" rx="6" fill="#fff" />
    <text x="30" y="25.5" textAnchor="middle" fill="#1a1f71" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontStyle="italic" fontWeight="900" letterSpacing="-.5">VISA</text>
  </svg>;
}

function Mastercard() {
  return <svg viewBox="0 0 60 38" role="img" aria-label="Mastercard">
    <rect width="60" height="38" rx="6" fill="#fff" />
    <circle cx="24.5" cy="19" r="11" fill="#eb001b" />
    <circle cx="35.5" cy="19" r="11" fill="#f79e1b" />
    <path d="M30 9.47a11 11 0 0 1 0 19.06a11 11 0 0 1 0-19.06z" fill="#ff5f00" />
  </svg>;
}

function MtnMomo() {
  return <svg viewBox="0 0 60 38" role="img" aria-label="MTN Mobile Money">
    <rect width="60" height="38" rx="6" fill="#ffcb05" />
    <ellipse cx="30" cy="12" rx="11" ry="5.2" fill="none" stroke="#000" strokeWidth="1.3" />
    <text x="30" y="14.4" textAnchor="middle" fill="#000" fontFamily="Arial, Helvetica, sans-serif" fontSize="6.6" fontWeight="900">MTN</text>
    <text x="30" y="30" textAnchor="middle" fill="#000" fontFamily="Arial, Helvetica, sans-serif" fontSize="10" fontWeight="800">MoMo</text>
  </svg>;
}

function TelecelCash() {
  return <svg viewBox="0 0 60 38" role="img" aria-label="Telecel Cash">
    <rect width="60" height="38" rx="6" fill="#e60000" />
    <text x="30" y="18" textAnchor="middle" fill="#fff" fontFamily="Arial, Helvetica, sans-serif" fontSize="10.5" fontWeight="700" letterSpacing="-.2">telecel</text>
    <text x="30" y="29" textAnchor="middle" fill="#fff" fontFamily="Arial, Helvetica, sans-serif" fontSize="8" fontWeight="400" letterSpacing=".6">cash</text>
  </svg>;
}

function AtMoney() {
  return <svg viewBox="0 0 60 38" role="img" aria-label="AT Money (AirtelTigo)">
    <rect width="60" height="38" rx="6" fill="#fff" />
    <text x="30" y="20" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="13" fontWeight="900"><tspan fill="#ed1c24">A</tspan><tspan fill="#0055a5">T</tspan></text>
    <text x="30" y="30.5" textAnchor="middle" fill="#0055a5" fontFamily="Arial, Helvetica, sans-serif" fontSize="7.5" fontWeight="700" letterSpacing=".4">MONEY</text>
  </svg>;
}

export function PaymentMethods({ className = "" }: { className?: string }) {
  return <div className={`payment-methods ${className}`.trim()}>
    <span>We accept</span>
    <ul aria-label="Payment methods">
      <li><MtnMomo /></li>
      <li><TelecelCash /></li>
      <li><AtMoney /></li>
      <li><Visa /></li>
      <li><Mastercard /></li>
    </ul>
  </div>;
}
