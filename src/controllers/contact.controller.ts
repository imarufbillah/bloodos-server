import type { Request, Response } from "express";
import {
  HTTP_STATUS,
  createInternalError,
} from "../middleware/error.middleware.js";
import { logger } from "../utils/logger.js";
import type { SubmitContactFormInput } from "../validators/contact.validator.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@bloodos.app";

async function sendContactEmail(
  formData: SubmitContactFormInput,
): Promise<void> {
  const { name, email, subject, message } = formData;

  // Email content
  const emailContent = {
    to: ADMIN_EMAIL,
    from: email,
    replyTo: email,
    subject: `[BloodOS Contact] ${subject}`,
    text: `
Contact Form Submission
=======================

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
Sent from BloodOS Contact Form
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #DC2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #6b7280; }
    .value { margin-top: 5px; }
    .message-box { background-color: white; padding: 15px; border-left: 4px solid #DC2626; margin-top: 10px; }
    .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">BloodOS Contact Form Submission</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Name</div>
        <div class="value">${name}</div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${email}">${email}</a></div>
      </div>
      <div class="field">
        <div class="label">Subject</div>
        <div class="value">${subject}</div>
      </div>
      <div class="field">
        <div class="label">Message</div>
        <div class="message-box">${message.replace(/\n/g, "<br>")}</div>
      </div>
    </div>
    <div class="footer">
      Sent from BloodOS Contact Form
    </div>
  </div>
</body>
</html>
    `.trim(),
  };

  // In development, log the email instead of sending
  if (process.env.NODE_ENV === "development") {
    console.log("\n=== Contact Form Email (Development Mode) ===");
    console.log(`To: ${emailContent.to}`);
    console.log(`From: ${emailContent.from}`);
    console.log(`Subject: ${emailContent.subject}`);
    console.log("\nText Content:");
    console.log(emailContent.text);
    console.log("\n===========================================\n");

    // Simulate async email sending
    await new Promise((resolve) => setTimeout(resolve, 100));
    return;
  }

  // For now, throw an error in production to signal that email service needs configuration
  throw new Error(
    "Email service not configured. Please set up nodemailer or another email service for production use.",
  );
}

// ============================================================================
// Submit Contact Form (POST /api/contact)
// ============================================================================
export async function submitContactForm(
  req: Request<{}, {}, SubmitContactFormInput>,
  res: Response,
): Promise<void> {
  const formData = req.body;

  try {
    // Send email to platform admin (Req 19.10)
    await sendContactEmail(formData);

    // Log contact form submission (for audit/tracking)
    console.log(
      `Contact form submitted by ${formData.name} (${formData.email})`,
    );

    // Return success response (Req 19.11)
    res.status(HTTP_STATUS.OK).json({
      message: "Message sent successfully. We'll get back to you soon!",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log the error for debugging
    logger.error("Error sending contact form email:", error);

    // Email delivery failure → 500 (Req 19.10, edge case handling)
    throw createInternalError(
      "Failed to send message. Please try again later or contact us directly via phone or social media.",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    );
  }
}
