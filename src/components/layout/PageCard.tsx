import { motion } from "framer-motion";
import { PaperTexture } from "../common/PaperTexture";

export function PageCard({
  page,
  motionKey,
  sectionRef = null,
  className,
  children,
  showTexture = true,
  ...motionProps
}) {
  return (
    <motion.section
      ref={sectionRef}
      key={motionKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      {...motionProps}
      className={className}
      style={{ background: page.paper, borderColor: "transparent" }}
    >
      {showTexture && <PaperTexture mode={page.texture} />}
      {children}
    </motion.section>
  );
}
