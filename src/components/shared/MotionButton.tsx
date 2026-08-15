import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

// A subtle press-scale for specific primary CTAs (Save, PDF export, ...)
// — deliberately not applied to the base Button component itself, since
// that would affect every button in the app. Use only at call sites that
// are genuinely major actions.
const MotionButton = motion.create(Button);

export default MotionButton;
