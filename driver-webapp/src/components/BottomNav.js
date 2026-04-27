import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
export default function BottomNav() {
    return (_jsxs("nav", { className: "bottom-nav", children: [_jsxs(NavLink, { to: "/", end: true, children: [_jsx("span", { style: { fontSize: '1.25rem' }, children: "\uD83C\uDFE0" }), _jsx("span", { children: "Home" })] }), _jsxs(NavLink, { to: "/earnings", children: [_jsx("span", { style: { fontSize: '1.25rem' }, children: "\uD83D\uDCB0" }), _jsx("span", { children: "Earnings" })] }), _jsxs(NavLink, { to: "/compliance", children: [_jsx("span", { style: { fontSize: '1.25rem' }, children: "\uD83D\uDCCB" }), _jsx("span", { children: "Docs" })] })] }));
}
