import {
  MultiTenantDatabaseState,
  CompanyProfile,
  Client,
  Voucher,
  User,
  SignupRequest,
  EmailNotificationLog,
  ItemMaster,
  ClientRequirement,
  ClientDocument,
  PaymentRecord,
  NewsCacheItem
} from '../types';

// Fresh-install dataset: no demo tenants, users, clients, vouchers, or content.
// Every array below is intentionally empty so a newly deployed instance starts
// as a blank slate — the first person to sign in registers a brand-new company.

export const demoCompanies: CompanyProfile[] = [];

export const demoUsers: User[] = [];

export const demoSignupRequests: SignupRequest[] = [];

export const demoEmailLogs: EmailNotificationLog[] = [];

export const demoItemCatalog: ItemMaster[] = [];

export const demoClients: Client[] = [];

export const demoClientRequirements: ClientRequirement[] = [];

export const demoClientDocuments: ClientDocument[] = [];

export const demoVouchers: Voucher[] = [];

export const demoPayments: PaymentRecord[] = [];

export const demoMarketNews: NewsCacheItem[] = [];

export const initialDatabaseState: MultiTenantDatabaseState = {
  currentCompanyId: '',
  currentUserId: '',
  companies: demoCompanies,
  users: demoUsers,
  signupRequests: demoSignupRequests,
  emailLogs: demoEmailLogs,
  clients: demoClients,
  clientDocuments: demoClientDocuments,
  clientRequirements: demoClientRequirements,
  itemCatalog: demoItemCatalog,
  vouchers: demoVouchers,
  payments: demoPayments,
  newsItems: demoMarketNews,
  version: 3,
  lastBackupAt: new Date().toISOString(),
};
