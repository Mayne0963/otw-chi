import React from "react";
import styles from "./OtwLiveMap.module.css";
import { OtwLocation } from "@/lib/otw/otwTypes";
import { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";

interface OtwLiveMapProps {
  pickup?: OtwLocation;
  dropoff?: OtwLocation;
  drivers?: OtwDriverLocation[];
}

const OtwLiveMap: React.FC<OtwLiveMapProps> = ({ pickup, dropoff, drivers = [] }) => {
  const hasAny = !!pickup || !!dropoff || (drivers && drivers.length > 0);

  if (!hasAny) {
    return (
      <div className={styles.mapShell}>
        <p className={styles.mapEmpty}>
          Live tracking will appear here once your OTW is on the move.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.mapShell}>
      <div className={styles.mapHeaderRow}>
        <span className={styles.mapTitle}>Live OTW Tracking</span>
        <span className={styles.mapHint}>Map integration coming soon</span>
      </div>

      <div className={styles.mapGrid}>
        {pickup && (
          <div className={styles.mapBlock}>
            <p className={styles.mapLabel}>Pickup</p>
            <p className={styles.mapCoord}>
              {pickup.label || "Location"}
              <br />
              Lat: {pickup.lat.toFixed(5)}, Lng: {pickup.lng.toFixed(5)}
            </p>
          </div>
        )}

        {dropoff && (
          <div className={styles.mapBlock}>
            <p className={styles.mapLabel}>Dropoff</p>
            <p className={styles.mapCoord}>
              {dropoff.label || "Location"}
              <br />
              Lat: {dropoff.lat.toFixed(5)}, Lng: {dropoff.lng.toFixed(5)}
            </p>
          </div>
        )}

        {drivers && drivers.length > 0 && (
          <div className={styles.mapBlock}>
            <p className={styles.mapLabel}>
              Active Driver{drivers.length > 1 ? "s" : ""}
            </p>
            <ul className={styles.driverList}>
              {drivers.map((d) => (
                <li key={d.driverId} className={styles.driverItem}>
                  <span className={styles.driverName}>{d.driverId}</span>
                  <span className={styles.driverCoord}>
                    Lat: {d.location.lat.toFixed(5)}, Lng: {d.location.lng.toFixed(5)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className={styles.mapFooter}>
        This view is map-ready: plug in Google Maps, Mapbox, or any provider to render a real-time route.
      </p>
    </div>
  );
};

export default OtwLiveMap;
