import { Router, type IRouter } from "express";
import {
  prescriptionsTable,
  treatmentsTable,
  labResultsTable,
  dentalRecordsTable,
} from "@workspace/db";
import { crudRouter } from "../lib/crud";

const router: IRouter = Router();

router.use(crudRouter({
  path: "/prescriptions",
  table: prescriptionsTable,
  idColumn: prescriptionsTable.id,
  defaults: () => ({ createdAt: Date.now(), medications: [] }),
  orderBy: prescriptionsTable.createdAt,
}));

router.use(crudRouter({
  path: "/treatments",
  table: treatmentsTable,
  idColumn: treatmentsTable.id,
  defaults: () => ({ createdAt: Date.now() }),
  orderBy: treatmentsTable.createdAt,
}));

router.use(crudRouter({
  path: "/lab-results",
  table: labResultsTable,
  idColumn: labResultsTable.id,
  defaults: () => ({ createdAt: Date.now() }),
  orderBy: labResultsTable.createdAt,
}));

router.use(crudRouter({
  path: "/dental-records",
  table: dentalRecordsTable,
  idColumn: dentalRecordsTable.id,
  defaults: () => ({ createdAt: Date.now() }),
  orderBy: dentalRecordsTable.createdAt,
}));

export default router;
