import { Router } from "express";
import { roomController } from "./room.controller";
import { asyncHandler } from "../../middleware/asyncHandler";
import { guestAuth, validate, validateParams } from "../../middleware";
import { CreateRoomSchema, JoinRoomSchema, RoomCodeParamsSchema, MessageQuerySchema } from "@room5/shared";

const router = Router();

router.post("/", asyncHandler(guestAuth), validate(CreateRoomSchema), asyncHandler(roomController.create));
router.get("/:code", asyncHandler(guestAuth), validateParams(RoomCodeParamsSchema), asyncHandler(roomController.getByCode));
router.post("/:code/join", asyncHandler(guestAuth), validate(JoinRoomSchema), asyncHandler(roomController.join));
router.post("/:code/leave", asyncHandler(guestAuth), validateParams(RoomCodeParamsSchema), asyncHandler(roomController.leave));
router.get("/:code/members", asyncHandler(guestAuth), validateParams(RoomCodeParamsSchema), asyncHandler(roomController.getMembers));
router.get("/:code/messages", asyncHandler(guestAuth), validateParams(RoomCodeParamsSchema), validate(MessageQuerySchema), asyncHandler(roomController.getMessages));

export default router;
