import React from "react";
import {
  MapPin,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MessageCircle,
  User,
  Bell,
  Bookmark,
  Star,
  CheckCircle,
  Check,
  ShieldCheck,
  Shield,
  Award,
  GraduationCap,
  Waves,
  CreditCard,
  Users,
  Activity,
  Clock,
  ArrowLeft,
  ArrowRight,
  Thermometer,
  Dumbbell,
  SlidersHorizontal,
  CloudUpload,
  Calendar,
  Sparkles,
  Heart,
  ExternalLink,
  ShieldAlert,
  Compass,
  ArrowUpDown,
  X,
  Navigation,
  Navigation2,
  Lock,
  Filter,
  Eye,
  EyeOff,
  RotateCw,
  Share2,
  Copy,
  Download,
  ThumbsUp,
  Info,
  HelpCircle,
  Phone,
  Mail,
  QrCode,
  Trophy,
  Target,
  Zap,
  Flame,
  Layers,
  FileText,
  FileCheck,
  Edit,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Home,
  Settings,
  LogOut,
  Send,
  Fingerprint,
  Camera,
  RotateCcw,
} from "lucide-react";

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, className = "", style }: IconProps) {
  const cleanName = (name || "").trim().toLowerCase();
  const baseClass = `${className} inline-block shrink-0 align-middle`;

  switch (cleanName) {
    case "location_on":
    case "pin_drop":
      return <MapPin className={baseClass} style={style} size={18} />;
    case "search":
      return <Search className={baseClass} style={style} size={18} />;
    case "arrow_drop_down":
    case "expand_more":
      return <ChevronDown className={baseClass} style={style} size={16} />;
    case "expand_less":
      return <ChevronUp className={baseClass} style={style} size={16} />;
    case "chat":
    case "forum":
      return <MessageCircle className={baseClass} style={style} size={18} />;
    case "person":
    case "account_circle":
      return <User className={baseClass} style={style} size={18} />;
    case "notifications":
    case "notifications_active":
      return <Bell className={baseClass} style={style} size={18} />;
    case "bookmark":
    case "bookmark_border":
      return <Bookmark className={baseClass} style={style} size={18} />;
    case "star":
      return <Star className={`${baseClass} fill-current`} style={style} size={16} />;
    case "verified":
    case "verified_user":
    case "security":
      return <ShieldCheck className={baseClass} style={style} size={18} />;
    case "shield":
    case "gshield":
      return <Shield className={baseClass} style={style} size={18} />;
    case "check_circle":
    case "check":
    case "all_done":
    case "done_all":
      return <CheckCircle className={baseClass} style={style} size={16} />;
    case "thermostat":
      return <Thermometer className={baseClass} style={style} size={18} />;
    case "photo_camera":
    case "camera":
    case "camera_alt":
      return <Camera className={baseClass} style={style} size={24} />;
      return <CloudUpload className={baseClass} style={style} size={20} />;
    case "send":
      return <Send className={baseClass} style={style} size={18} />;
    case "fingerprint":
      return <Fingerprint className={baseClass} style={style} size={18} />;
    case "policy":
    case "health_and_safety":
      return <ShieldCheck className={baseClass} style={style} size={18} />;
    case "request_quote":
      return <CreditCard className={baseClass} style={style} size={18} />;
    case "hourglass_top":
    case "timer":
    case "schedule":
    case "access_time":
      return <Clock className={baseClass} style={style} size={16} />;
    case "picture_as_pdf":
      return <FileText className={baseClass} style={style} size={18} />;
    case "event_available":
    case "calendar_month":
    case "calendar_today":
      return <Calendar className={baseClass} style={style} size={18} />;
    case "engineering":
      return <Settings className={baseClass} style={style} size={18} />;
    case "stars":
    case "sports_score":
    case "workspace_premium":
      return <Sparkles className={baseClass} style={style} size={20} />;
    case "chevron_left":
      return <ChevronLeft className={baseClass} style={style} size={18} />;
    case "chevron_right":
      return <ChevronRight className={baseClass} style={style} size={18} />;
    case "badge":
      return <Award className={baseClass} style={style} size={20} />;
    case "school":
      return <GraduationCap className={baseClass} style={style} size={20} />;
    case "water":
    case "water_ec":
    case "pool":
    case "waves":
      return <Waves className={baseClass} style={style} size={20} />;
    case "payments":
      return <CreditCard className={baseClass} style={style} size={20} />;
    case "groups":
    case "group":
      return <Users className={baseClass} style={style} size={20} />;
    case "medical_services":
      return <Activity className={baseClass} style={style} size={20} />;
    case "schedule":
    case "access_time":
      return <Clock className={baseClass} style={style} size={16} />;
    case "arrow_back":
      return <ArrowLeft className={baseClass} style={style} size={18} />;
    case "arrow_forward":
      return <ArrowRight className={baseClass} style={style} size={18} />;
    case "fitness_center":
      return <Dumbbell className={baseClass} style={style} size={18} />;
    case "tune":
      return <SlidersHorizontal className={baseClass} style={style} size={18} />;
    case "calendar_month":
    case "calendar_today":
      return <Calendar className={baseClass} style={style} size={18} />;
    case "sports_score":
    case "workspace_premium":
      return <Sparkles className={baseClass} style={style} size={20} />;
    case "favorite":
    case "favorite_border":
      return <Heart className={baseClass} style={style} size={18} />;
    case "explore":
      return <Compass className={baseClass} style={style} size={20} />;
    case "swap_vert":
      return <ArrowUpDown className={baseClass} style={style} size={16} />;
    case "near_me":
      return <Navigation className={baseClass} style={style} size={18} />;
    case "directions":
      return <Navigation2 className={baseClass} style={style} size={18} />;
    case "close":
    case "clear":
      return <X className={baseClass} style={style} size={18} />;
    case "sports_soccer":
      return <Target className={baseClass} style={style} size={18} />;
    case "sports_martial_arts":
      return <Zap className={baseClass} style={style} size={18} />;
    case "sports_tennis":
      return <Activity className={baseClass} style={style} size={18} />;
    case "lock":
      return <Lock className={baseClass} style={style} size={18} />;
    case "lock_reset":
      return <RotateCw className={baseClass} style={style} size={24} />;
    case "filter_list":
      return <Filter className={baseClass} style={style} size={18} />;
    case "visibility":
      return <Eye className={baseClass} style={style} size={18} />;
    case "visibility_off":
      return <EyeOff className={baseClass} style={style} size={18} />;
    case "refresh":
    case "sync":
      return <RotateCw className={baseClass} style={style} size={18} />;
    case "share":
      return <Share2 className={baseClass} style={style} size={18} />;
    case "content_copy":
      return <Copy className={baseClass} style={style} size={18} />;
    case "download":
      return <Download className={baseClass} style={style} size={18} />;
    case "thumb_up":
      return <ThumbsUp className={baseClass} style={style} size={18} />;
    case "info":
      return <Info className={baseClass} style={style} size={18} />;
    case "help":
    case "help_outline":
      return <HelpCircle className={baseClass} style={style} size={18} />;
    case "phone":
    case "call":
      return <Phone className={baseClass} style={style} size={18} />;
    case "mail":
    case "email":
      return <Mail className={baseClass} style={style} size={18} />;
    case "qr_code":
    case "qr_code_scanner":
      return <QrCode className={baseClass} style={style} size={20} />;
    case "trophy":
    case "military_tech":
      return <Trophy className={baseClass} style={style} size={20} />;
    case "home":
      return <Home className={baseClass} style={style} size={18} />;
    case "settings":
      return <Settings className={baseClass} style={style} size={18} />;
    case "logout":
      return <LogOut className={baseClass} style={style} size={18} />;
    case "edit":
      return <Edit className={baseClass} style={style} size={18} />;
    case "delete":
      return <Trash2 className={baseClass} style={style} size={18} />;
    case "add":
      return <Plus className={baseClass} style={style} size={18} />;
    case "remove":
      return <Minus className={baseClass} style={style} size={18} />;
    case "layers":
      return <Layers className={baseClass} style={style} size={18} />;
    case "description":
    case "article":
      return <FileText className={baseClass} style={style} size={18} />;
    case "assignment_turned_in":
      return <FileCheck className={baseClass} style={style} size={18} />;
    default:
      return <span className={`material-symbols-outlined ${className}`} style={style}>{cleanName}</span>;
  }
}
