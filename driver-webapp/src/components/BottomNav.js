import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
export default function BottomNav() {
    return (_jsxs("nav", { className: "bottom-nav", children: [_jsxs(NavLink, { to: "/", end: true, children: [_jsx("span", { style: { fontSize: '1.25rem' }, children: "\uD83C\uDFE0" }), _jsx("span", { children: "\u05D1\u05D9\u05EA" })] }), _jsxs(NavLink, { to: "/earnings", children: [_jsx("span", { style: { fontSize: '1.25rem' }, children: "\uD83D\uDCB0" }), _jsx("span", { children: "\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA" })] }), _jsxs(NavLink, { to: "/compliance", children: [_jsx("span", { style: { fontSize: '1.25rem' }, children: "\uD83D\uDCCB" }), _jsx("span", { children: "\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD" })] }), _jsxs(NavLink, { to: "/profile", children: [_jsx("span", { style: { fontSize: '1.25rem' }, children: "\uD83D\uDC64" }), _jsx("span", { children: "\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC" })] })] }));
}
