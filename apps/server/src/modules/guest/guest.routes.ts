import { Router } from "express";
import { guestController } from "./guest.controller";
import { asyncHandler } from "../../middleware/asyncHandler";
import { guestAuth, validate } from "../../middleware";
import { CreateGuestSchema, UpdateGuestSchema } from "@room5/shared";

const router = Router();

router.post("/", validate(CreateGuestSchema), asyncHandler(guestController.createOrGet));
router.get("/", asyncHandler(guestAuth), asyncHandler(guestController.get));
router.patch("/", asyncHandler(guestAuth), validate(UpdateGuestSchema), asyncHandler(guestController.update));

export default router;
