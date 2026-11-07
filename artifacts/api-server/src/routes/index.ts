import { Router, type IRouter } from "express";
import healthRouter from "./health";
import docsRouter from "./docs";
import patientsRouter from "./patients";
import employeesRouter from "./doctors";
import appointmentsRouter from "./appointments";
import queueRouter from "./queue";
import servicesRouter from "./services";
import clinicalRouter from "./clinical";
import financeRouter from "./finance";
import inventoryRouter from "./inventory";
import systemRouter from "./system";
import reportsRouter from "./reports";
import callCenterRouter from "./callcenter";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(docsRouter);
router.use(patientsRouter);
router.use(employeesRouter);
router.use(appointmentsRouter);
router.use(queueRouter);
router.use(servicesRouter);
router.use(clinicalRouter);
router.use(financeRouter);
router.use(inventoryRouter);
router.use(systemRouter);
router.use(reportsRouter);
router.use(callCenterRouter);

export default router;
