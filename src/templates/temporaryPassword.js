module.exports = ({ userName, tempPassword, loginUrl, year }) => `
<div style="font-family: Arial, sans-serif; background-color: #f7f9fc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #333333;">Welcome, ${userName}!</h1>

    <p style="color: #555555;">
      Your account has been successfully created.
    </p>

    <p><strong>Temporary Password:</strong></p>
    <div style="background:#f1f1f1;padding:10px;font-family:monospace;">
      ${tempPassword}
    </div>

    <a href="${loginUrl}" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px;">
      Log In & Change Password
    </a>

    <p style="margin-top:20px;">— GP Textiles Team</p>

    <div style="font-size:12px;color:#888;text-align:center;margin-top:30px;">
      © ${year} GP Textiles
    </div>
  </div>
</div>
`;
