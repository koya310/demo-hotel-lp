// api/contact.js — Vercel Serverless Function
// Resend API でメール2通送信:
//   ① 運用通知: support@irohani.tech へ
//   ② 自動返信: 送信者へ (FROM: support@irohani.tech)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, service, message } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'お名前とメールアドレスは必須です' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const FROM = 'いろはにテック <support@irohani.tech>';
  const SUPPORT = 'support@irohani.tech';

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const sendMail = (payload) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  try {
    // ① 運用通知メール
    const r1 = await sendMail({
      from: FROM,
      to: [SUPPORT],
      reply_to: email,
      subject: `【新規お問い合わせ】${esc(name)} 様より`,
      html: `
        <h2 style="margin:0 0 16px;color:#1a1a1a">新規お問い合わせが届きました</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;width:130px;background:#f9f9f9">お名前</td>
              <td style="padding:8px 12px;border:1px solid #ddd">${esc(name)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;background:#f9f9f9">メール</td>
              <td style="padding:8px 12px;border:1px solid #ddd"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;background:#f9f9f9">ご相談内容</td>
              <td style="padding:8px 12px;border:1px solid #ddd">${esc(service || '未選択')}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;background:#f9f9f9">メッセージ</td>
              <td style="padding:8px 12px;border:1px solid #ddd">${esc(message || 'なし').replace(/\n/g, '<br>')}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:12px;color:#888">送信元サイト: hotel-lp</p>
      `,
    });

    if (!r1.ok) {
      const txt = await r1.text();
      console.error('Notify email failed:', r1.status, txt);
      return res.status(502).json({ error: 'メール送信に失敗しました' });
    }

    // ② 送信者への自動返信
    await sendMail({
      from: FROM,
      to: [email],
      subject: 'お問い合わせを受け付けました | いろはにテック',
      html: `
        <div style="font-family:sans-serif;max-width:560px;color:#1a1a1a">
          <p style="font-size:16px">${esc(name)} 様</p>
          <p>お問い合わせいただきありがとうございます。<br>
          内容を確認のうえ、<strong>通常48時間以内</strong>にご返信いたします。</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="font-size:13px;color:#555"><strong>受付内容</strong><br>
          ご相談内容：${esc(service || '未選択')}<br>
          メッセージ：${esc(message || 'なし').replace(/\n/g, '<br>')}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="font-size:12px;color:#888">
            いろはにテック<br>
            <a href="mailto:support@irohani.tech" style="color:#888">support@irohani.tech</a>
          </p>
        </div>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
