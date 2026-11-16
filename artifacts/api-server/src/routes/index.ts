import { Router, type IRouter } from "express";
import healthRouter from "./health";
import earlyAccessRouter from "./early-access";

const router: IRouter = Router();

router.use(earlyAccessRouter);
router.use(healthRouter);

export default router;
