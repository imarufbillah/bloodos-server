/**
 * Contact Form Controller (Phase 5g)
 * Implements contact form submission endpoint
 * Requirements: 19.7-19.10
 */

import type { Request, Response } from "express";
import { HTTP_STATUS, createInternalError } from "../middleware/error.middleware.js";
import type { SubmitContactFormInput } from "../validators/contact.validator.js";

// ============================================================================
// Email Configuration
// ============================================================================

/**
 * Platform admin email address for contact form submissions
 * In production, this should be configured via environment variable
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@bloodos.app";

// ============================================================================
// Email Service (Placeholder)
// ============================================================================

/**
 * Send contact form email to platform admin (Req 19.10)
 * 
 * NOTE: This is a placeholder implementation that logs emails in development.
 * For production, integrate with a proper email service like:
 * - Nodemailer with SMTP
 * - SendGrid
 * - AWS SES
 * - Mailgun
 * 
 * To integrate a real email service:
 * 1. Install the email library: npm install nodemailer @types/nodemailer
 * 2. Add email credentials to .env file
 * 3. Replace this function with actual email sending logic
 * 4. Add proper error handling and retry logic
 * 
 * @param formData - Contact form submission data
 * @returns Promise that resolves when email is sent
 * @throws Error if email sending fails
 */
async function sendContactEmail(formData: SubmitContactFormInput): Promise<void> {
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
        <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
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

  // Production email sending would go here
  // Example with nodemailer:
  /*
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"BloodOS" <${process.env.SMTP_USER}>`,
    to: emailContent.to,
    replyTo: emailContent.replyTo,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });
  */

  // For now, throw an error in production to signal that email service needs configuration
  throw new Error(
    "Email service not configured. Please set up nodemailer or another email service for production use."
  );
}

// ============================================================================
// Submit Contact Form (POST /api/contact)
// ============================================================================

/**
 * Submit contact form (Req 19.7-19.11)
 * - Public endpoint (no auth required)
 * - Validates form data via Zod middleware
 * - Sends email to platform admin (Req 19.10)
 * - Returns success message on completion
 * 
 * Edge cases:
 * - Validation failure → 400 with field errors (handled by validate middleware)
 * - Email delivery failure → 500 internal error
 * 
 * @param req - Express request with validated body
 * @param res - Express response
 */
export async function submitContactForm(
  req: Request<{}, {}, SubmitContactFormInput>,
  res: Response
): Promise<void> {
  const formData = req.body;

  try {
    // Send email to platform admin (Req 19.10)
    await sendContactEmail(formData);

    // Log contact form submission (for audit/tracking)
    console.log(`Contact form submitted by ${formData.name} (${formData.email})`);

    // Return success response (Req 19.11)
    res.status(HTTP_STATUS.OK).json({
      message: "Message sent successfully. We'll get back to you soon!",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log the error for debugging
    console.error("Error sending contact form email:", error);

    // Email delivery failure → 500 (Req 19.10, edge case handling)
    throw createInternalError(
      "Failed to send message. Please try again later or contact us directly via phone or social media.",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );
  }
}
