module.exports = ({
  userName,
  taskTitle,
  taskDescription,
  taskDeadline,
  taskPriority,
  taskUrl,
  year,
}) => `
<div style="font-family: Arial, sans-serif; background-color: #f7f9fc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
    <h1>Hello, ${userName}</h1>

    <p>You have been assigned a new task.</p>

    <div style="background:#f1f1f1;padding:15px;">
      <p><strong>Task:</strong> ${taskTitle}</p>
      <p><strong>Description:</strong> ${taskDescription}</p>
      <p><strong>Deadline:</strong> ${taskDeadline}</p>
      <p><strong>Priority:</strong> ${taskPriority}</p>
    </div>

    <a href="${taskUrl}" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#007bff;color:#fff;text-decoration:none;">
      View Task
    </a>

    <p style="margin-top:20px;">— GP Textiles ERP Team</p>

    <div style="font-size:12px;color:#888;text-align:center;margin-top:30px;">
      © ${year} GP Textiles ERP
    </div>
  </div>
</div>
`;
