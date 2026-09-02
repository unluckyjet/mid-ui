import type { PropsWithChildren } from "react";
import styles from "./background.module.css";

type BackgroundProps = Readonly<
  PropsWithChildren<{
    className?: string;
  }>
>;

export function Background({ children, className }: BackgroundProps) {
  const classNames = [styles.background, className].filter(Boolean).join(" ");

  return (
    <div className={classNames} data-mid-ui="background">
      <span className={styles.aurora} aria-hidden="true" />
      {children}
    </div>
  );
}
