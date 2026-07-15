import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  uploadAvatarMiddleware,
  uploadAvatar,
} from "../controllers/upload.controller.js";

const router = Router();

router.post("/me/avatar", requireAuth, uploadAvatarMiddleware, uploadAvatar);

export default router;
