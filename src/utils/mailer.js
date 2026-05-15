const nodemailer = require("nodemailer");
const tempPasswordTemplate = require("../templates/temporaryPassword");
const assignedTaskTemplate = require("../templates/assignedTask");
const transporter = nodemailer.createTransport({
  // host: "sandbox.smtp.mailtrap.io",
  service: "gmail",
  // port: 2525,
  // secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

exports.sendTemporaryPasswordMail = async (toEmail, tempPassword, userName) => {
  const html = tempPasswordTemplate({
    userName,
    tempPassword,
    loginUrl: process.env.LOGIN_URL,
    year: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: `"GP Textiles ERP" <procease.erp@gmail.com>`,
    to: toEmail,
    subject: "Temporary Password for GP Textiles",
    html,
  });
};

exports.sendAssignedTaskMail = async (
  toEmail,
  userName,
  taskTitle,
  taskDescription,
  taskDeadline,
  taskPriority
) => {
  const html = assignedTaskTemplate({
    userName,
    taskTitle,
    taskDescription,
    taskDeadline,
    taskPriority,
    taskUrl: process.env.TASK_URL,
    year: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: `"GP Textiles ERP" <procease.erp@gmail.com>`,
    to: toEmail,
    subject: "New Task Assignment",
    html,
  });
};

// exports.sendTemporaryPasswordMail = async (toEmail, tempPassword, userName) => {
//   console.log("email sending.....");
//   const year = new Date().getFullYear();
//   const loginUrl = "http://localhost:8080";
//   const mailOptions = {
//     // from: `"Your App" <ac7e35f2eb3fb3>`,
//     from: `"GP Textiles ERP" <procease.erp@gmail.com>`,

//     to: toEmail,
//     subject: "Temporary Password for GP Textiles",
//     html: `
//   <div style="font-family: Arial, sans-serif; background-color: #f7f9fc; padding: 20px;">
//     <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
//       <h1 style="color: #333333;">Welcome, ${userName}! 🎉</h1>
//       <p style="color: #555555; line-height: 1.6;">
//         Your account has been successfully created. We're excited to have you on board!
//       </p>

//       <p style="color: #555555; line-height: 1.6;">Here’s your <strong>temporary password</strong>:</p>
//       <div style="display: inline-block; background-color: #f1f1f1; padding: 10px 15px; margin: 10px 0; font-weight: bold; border-radius: 5px; font-family: monospace;">
//         ${tempPassword}
//       </div>

//       <p style="color: #555555; line-height: 1.6;">
//         To keep your account secure, please log in and update your password right away.
//       </p>

//       <a href="${loginUrl}" style="display: inline-block; padding: 12px 20px; margin-top: 20px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
//         Log In & Change Password
//       </a>

//       <p style="color: #555555; line-height: 1.6; margin-top: 20px;"><strong>Quick Start Tips:</strong></p>
//       <ul style="color: #555555; line-height: 1.6;">
//         <li>Click the button above to log in.</li>
//         <li>Choose a strong, unique password you’ll remember.</li>
//         <li>Explore your new account and start enjoying !</li>
//       </ul>

//       <p style="color: #555555; line-height: 1.6;">
//         Need help? Our support team is always ready to assist you — just reply to this email.
//       </p>

//       <p style="color: #555555; line-height: 1.6;">
//         Cheers,<br>
//         <strong>The GP Textiles Team</strong>
//       </p>

//       <div style="font-size: 12px; color: #888888; text-align: center; margin-top: 30px;">
//         &copy; ${year} GP Textiles. All rights reserved.
//       </div>
//     </div>
//   </div>
// `,
//   };

//   await transporter.sendMail(mailOptions);

//   console.log("email sent.....");
// };

// exports.sendAssignedTaskMail = async (
//   toEmail,
//   userName,
//   taskTitle,
//   taskDescription,
//   taskDeadline,
//   taskPriority
// ) => {
//   console.log("email sending.....");
//   const year = new Date().getFullYear();
//   const taskUrl = "http://localhost:8080/tasks";
//   const mailOptions = {
//     // from: `"Your App" <ac7e35f2eb3fb3>`,
//     from: `"GP Textiles ERP" <procease.erp@gmail.com>`,

//     to: toEmail,
//     subject: "New Task Assignment",
//     html: `
//   <div style="font-family: Arial, sans-serif; background-color: #f7f9fc; padding: 20px;">
//   <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
//     <h1 style="color: #333333;">Hello, ${userName} 👋</h1>

//     <p style="color: #555555; line-height: 1.6;">
//       You have been assigned a new task in <strong>GP Textiles ERP</strong>.
//     </p>

//     <div style="background-color: #f1f1f1; padding: 15px; margin: 15px 0; border-radius: 5px;">
//       <p><strong>Task:</strong> ${taskTitle}</p>
//       <p><strong>Description:</strong> ${taskDescription}</p>
//       <p><strong>Deadline:</strong> ${taskDeadline}</p>
//       <p><strong>Priority:</strong> ${taskPriority}</p>
//     </div>

//     <p style="color: #555555; line-height: 1.6;">
//       You can view and manage this task by clicking the button below:
//     </p>

//     <a href="${taskUrl}" style="display: inline-block; padding: 12px 20px; margin-top: 20px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">
//       View Task
//     </a>

//     <p style="color: #555555; line-height: 1.6; margin-top: 20px;">
//       Please ensure to complete the task by the given deadline. If you have any questions, feel free to contact your supervisor.
//     </p>

//     <p style="color: #555555; line-height: 1.6;">
//       Cheers,<br>
//       <strong>The GP Textiles ERP Team</strong>
//     </p>

//     <div style="font-size: 12px; color: #888888; text-align: center; margin-top: 30px;">
//       &copy; ${year} GP Textiles ERP. All rights reserved.
//     </div>
//   </div>
// </div>

// `,
//   };

//   await transporter.sendMail(mailOptions);

//   console.log("email sent.....");
// };

// // // Looking to send emails in production? Check out our Email API/SMTP product!
// // var transport = nodemailer.createTransport({
// //   host: "sandbox.smtp.mailtrap.io",
// //   port: 2525,
// //   auth: {
// //     user: "ac7e35f2eb3fb3",
// //     pass: "ce6b4c6438e2d3"
// //   }
// // });

// // const nodemailer = require("nodemailer");
// // const { MailtrapTransport } = require("@mailtrap/mailtrap-node");

// // const TOKEN = "3dcf41845d958f7cba4995f30ac9f561";

// // const transport = nodemailer.createTransport(
// //   MailtrapTransport({ token: TOKEN })
// // );

// // const sender = {
// //   address: "hello@demomailtrap.co",
// //   name: "Mailtrap Test",
// // };

// // const recipients = ["dokaj86556@besenica.com"];

// // transport
// //   .sendMail({
// //     from: sender,
// //     to: recipients,
// //     subject: "You are awesome!",
// //     text: "Congrats for sending test email with Mailtrap!",
// //   })
// //   .then((info) => console.log("Email sent:", info))
// //   .catch((err) => console.error("Error sending email:", err));
