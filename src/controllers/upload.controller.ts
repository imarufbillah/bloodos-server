import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import multer from "multer";
import sharp from "sharp";
import { config } from "../config/env.js";
import { getUsersCollection } from "../db/collections.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  asyncHandler,
  createValidationError,
  HTTP_STATUS,
} from "../middleware/error.middleware.js";

const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createValidationError("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

export const uploadAvatarMiddleware = upload.single("avatar");

async function uploadToImgbb(buffer: Buffer): Promise<string> {
  const base64 = buffer.toString("base64");

  const formData = new URLSearchParams();
  formData.append("key", config.imgbb.apiKey);
  formData.append("image", base64);

  const response = await fetch(IMGBB_ENDPOINT, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`imgbb upload failed: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as {
    data: { url: string; display_url: string };
    success: boolean;
  };

  if (!result.success || !result.data?.url) {
    throw new Error("imgbb returned unsuccessful response");
  }

  return result.data.url;
}

export const uploadAvatar = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const sessionUser = (req as AuthenticatedRequest).sessionUser;
    const file = (req as MulterRequest).file;

    if (!file) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: "validation_error",
        message: "No image file provided",
        details: null,
      });
      return;
    }

    // Resize and convert to WebP
    const optimized = await sharp(file.buffer)
      .resize(200, 200, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();

    // Upload to imgbb
    const imageUrl = await uploadToImgbb(optimized);

    // Save URL to database
    const collection = getUsersCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(sessionUser.id) },
      { $set: { image: imageUrl, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        code: "not_found",
        message: "User not found",
        details: null,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      message: "Avatar uploaded successfully",
      image: imageUrl,
    });
  }
);

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
