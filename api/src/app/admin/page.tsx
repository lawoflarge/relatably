import Link from "next/link";

export default function AdminLanding() {
  return (
    <section>
      <p>Pick a console:</p>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
        <li><Link href="/admin/candidates" style={linkStyle}>Question candidates → curate / approve / reject</Link></li>
        <li><Link href="/admin/schedule" style={linkStyle}>Scheduled questions → set drop times</Link></li>
        <li><Link href="/admin/trigger" style={linkStyle}>Manually trigger next drop (test / soft-launch)</Link></li>
      </ul>
    </section>
  );
}

const linkStyle: React.CSSProperties = {
  color: "#facc15",
  fontSize: 16,
  textDecoration: "none",
  display: "block",
  padding: "12px 16px",
  border: "1px solid #333",
  borderRadius: 6,
};
