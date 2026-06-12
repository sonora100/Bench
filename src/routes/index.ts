import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import shopSettingsRouter from "./shop_settings";
import categoriesRouter from "./categories";
import servicesRouter from "./services";
import metalPricesRouter from "./metal_prices";
import estimatesRouter from "./estimates";
import customersRouter from "./customers";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import photosRouter from "./photos";
import reportsRouter from "./reports";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);

router.use(requireAuth);

router.use(shopSettingsRouter);
router.use(categoriesRouter);
router.use(servicesRouter);
router.use(metalPricesRouter);
router.use(estimatesRouter);
router.use(customersRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(photosRouter);
router.use(reportsRouter);

export default router;
