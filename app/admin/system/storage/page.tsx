import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { requireRole } from '@/lib/auth';
import { getPickupPassBase64UsageMetrics } from '@/lib/admin/base64-usage';
import { formatDate } from '@/lib/utils';

const WARNING_THRESHOLD_BYTES = 250 * 1024 * 1024;
const SWITCH_THRESHOLD_BYTES = 500 * 1024 * 1024;
const EMERGENCY_THRESHOLD_BYTES = 1024 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getThresholdState(totalBytes: number) {
  if (totalBytes >= EMERGENCY_THRESHOLD_BYTES) {
    return {
      label: 'Emergency',
      className: 'text-red-300',
    };
  }

  if (totalBytes >= SWITCH_THRESHOLD_BYTES) {
    return {
      label: 'Must switch at 500MB',
      className: 'text-orange-300',
    };
  }

  if (totalBytes >= WARNING_THRESHOLD_BYTES) {
    return {
      label: 'Warning at 250MB',
      className: 'text-yellow-300',
    };
  }

  return {
    label: 'Healthy',
    className: 'text-green-300',
  };
}

export default async function AdminStorageSystemPage() {
  await requireRole(['ADMIN']);
  const metrics = await getPickupPassBase64UsageMetrics();
  const thresholdState = getThresholdState(metrics.totalBytes);

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Storage Monitor"
        subtitle="Base64 pickup-pass usage and safety thresholds."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm text-white/70">Total Base64 Stored</div>
          <div className="mt-2 text-2xl font-semibold text-white">{formatBytes(metrics.totalBytes)}</div>
          <div className={`mt-2 text-xs font-medium ${thresholdState.className}`}>{thresholdState.label}</div>
        </OtwCard>

        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm text-white/70">Requests With Base64</div>
          <div className="mt-2 text-2xl font-semibold text-white">{metrics.countWithBase64}</div>
          <div className="mt-2 text-xs text-white/55">Rows where pickupPassBase64 is present</div>
        </OtwCard>

        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm text-white/70">Expiring Within 48 Hours</div>
          <div className="mt-2 text-2xl font-semibold text-white">{metrics.expiringSoonCount}</div>
          <div className="mt-2 text-xs text-white/55">Should be purged soon by cron</div>
        </OtwCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm text-white/70">Average Stored Size</div>
          <div className="mt-2 text-xl font-semibold text-white">{formatBytes(metrics.avgBytes)}</div>
          <div className="mt-2 text-xs text-white/55">Average LENGTH(pickupPassBase64)</div>
        </OtwCard>

        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm text-white/70">Max Stored Size</div>
          <div className="mt-2 text-xl font-semibold text-white">{formatBytes(metrics.maxBytes)}</div>
          <div className="mt-2 text-xs text-white/55">Largest single base64 row</div>
        </OtwCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm text-white/70">Oldest Upload Timestamp</div>
          <div className="mt-2 text-sm text-white">
            {metrics.oldestUploadedAt ? formatDate(metrics.oldestUploadedAt) : 'None'}
          </div>
        </OtwCard>

        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm text-white/70">Thresholds</div>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            <li>Warning: 250MB</li>
            <li>Must switch: 500MB</li>
            <li>Emergency: 1GB</li>
          </ul>
          <div className="mt-4">
            <OtwButton as="a" href="/admin" variant="ghost" className="text-xs">
              Back to Admin
            </OtwButton>
          </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
