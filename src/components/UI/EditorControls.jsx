import React, { useState, useEffect, useRef, useMemo } from "react";
import FontUploader from "./FontUploader";

export function SidebarSection({ title, icon, children }) {
    const Icon = icon;

    return (
        <div className="rounded-xl bg-white mb-6">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 text-teal-600">
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-900">
                    {title}
                </span>
            </div>

            <div className="ml-1 pl-1">
                <div className="space-y-4">{children}</div>
            </div>
        </div>
    );
}

export function ControlInput({ label, value, onChange, placeholder }) {
    const safeValue = value ?? "";

    return (
        <label className="block space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                {label}
            </span>
            <input
                type="text"
                value={safeValue}
                onChange={(event) => onChange?.(event)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#14b8a6] focus:bg-white focus:ring-2 focus:ring-[#14b8a6]/20 shadow-sm"
            />
        </label>
    );
}

export function ControlSlider({
    label,
    value,
    min,
    max,
    step,
    unit,
    onChange,
    disabled = false,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isEditing) setTempValue(value);
    }, [value, isEditing]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleInputChange = (e) => {
        const rawVal = e.target.value;
        setTempValue(rawVal);

        const parsed = parseFloat(rawVal);
        if (!isNaN(parsed)) {
            let safeVal = parsed;
            if (safeVal < min) safeVal = min;
            if (safeVal > max) safeVal = max;

            onChange(safeVal);
        }
    };

    const handleCommit = () => {
        setIsEditing(false);
        let parsed = parseFloat(tempValue);

        if (isNaN(parsed)) {
            setTempValue(value);
            return;
        }

        if (parsed < min) parsed = min;
        if (parsed > max) parsed = max;

        setTempValue(parsed);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleCommit();
            inputRef.current?.blur();
        }
        if (e.key === "Escape") {
            setIsEditing(false);
            setTempValue(value);
            onChange(value);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                    {label}
                </span>

                {isEditing ? (
                    <div className="flex items-center gap-1">
                        <input
                            ref={inputRef}
                            type="number"
                            step={step}
                            value={tempValue}
                            onChange={handleInputChange}
                            onBlur={handleCommit}
                            onKeyDown={handleKeyDown}
                            className="w-14 rounded-md border border-[#14b8a6] bg-white px-1 py-0.5 text-right text-[10px] font-bold text-gray-900 outline-none shadow-sm"
                        />
                        <span className="text-[10px] font-semibold text-gray-400">
                            {unit}
                        </span>
                    </div>
                ) : (
                    <span
                        onDoubleClick={() => setIsEditing(true)}
                        title="Double-click to edit exact value"
                        className="inline-flex cursor-text items-center rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-700 transition-colors hover:bg-teal-50 hover:text-[#14b8a6]">
                        {value} {unit}
                    </span>
                )}
            </div>

            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                className={`h-1.5 w-full cursor-pointer appearance-none rounded-full ${disabled ? 'bg-gray-200 accent-gray-400 opacity-50 cursor-not-allowed' : 'bg-gray-200 accent-[#14b8a6]'}`}
            />
        </div>
    );
}

export function ControlSelect({ label, value, onChange, options, prefixType }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef(null);

    const sortedOptions = useMemo(() => {
        return [...(options || [])].sort((a, b) =>
            a.label.localeCompare(b.label),
        );
    }, [options]);

    const filteredOptions = useMemo(() => {
        if (!search) return sortedOptions;
        return sortedOptions.filter((opt) =>
            opt.label.toLowerCase().includes(search.toLowerCase()),
        );
    }, [sortedOptions, search]);

    const selected =
        (options || []).find((option) => option.value === value) ||
        sortedOptions[0] ||
        null;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
                setSearch("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (selectedValue) => {
        onChange(selectedValue);
        setIsOpen(false);
        setSearch("");
    };

    return (
        <div className="space-y-1.5" ref={dropdownRef}>
            <div className="flex justify-between items-center pr-1">
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                    {label}
                </span>
                {prefixType === "font" && <FontUploader onFontAdded={(id) => onChange(id)} />}
            </div>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className={`flex w-full items-center justify-between rounded-xl border bg-gray-50 px-3 py-2.5 text-sm transition-all shadow-sm ${
                        isOpen
                            ? "border-[#14b8a6] bg-white ring-2 ring-[#14b8a6]/20"
                            : "border-gray-200 hover:border-gray-300"
                    }`}>
                    <div className="flex items-center gap-2 truncate">
                        {prefixType === "font" ? (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-200/50 text-[10px] font-bold text-gray-600">
                                Aa
                            </span>
                        ) : prefixType === "color" ? (
                            <span
                                className="h-4 w-4 shrink-0 rounded-full border border-gray-200 shadow-inner"
                                style={{
                                    backgroundColor:
                                        selected?.hex ||
                                        selected?.value ||
                                        "#dfe7e7",
                                }}
                            />
                        ) : null}

                        <span className="truncate font-medium text-gray-900">
                            {selected?.label || "Select"}
                        </span>
                    </div>

                    <div
                        className={`shrink-0 text-gray-400 transition-transform ${
                            isOpen ? "rotate-180 text-[#14b8a6]" : ""
                        }`}>
                        <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4">
                            <path d="M5.25 7.5 10 12.25 14.75 7.5H5.25Z" />
                        </svg>
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                        {prefixType === "font" && (
                            <div className="border-b border-gray-100 bg-gray-50/50 p-2">
                                <input
                                    type="text"
                                    placeholder="Search fonts..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none transition-all placeholder:text-gray-400 focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="max-h-56 overflow-y-auto p-1.5">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            handleSelect(option.value)
                                        }
                                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                                            option.value === value
                                                ? "bg-teal-50 font-bold text-[#14b8a6]"
                                                : "font-medium text-gray-600 hover:bg-gray-50"
                                        }`}>
                                        {prefixType === "color" && (
                                            <span
                                                className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200 shadow-inner"
                                                style={{
                                                    backgroundColor:
                                                        option.hex ||
                                                        option.value,
                                                }}
                                            />
                                        )}
                                        <span className="truncate">
                                            {option.label}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="px-3 py-4 text-center text-xs text-slate-400">
                                    No results found
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ControlToggle({ label, checked, onChange }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                {label}
            </span>
            <button
                type="button"
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    checked
                        ? "bg-[#14b8a6]"
                        : "bg-gray-200 hover:bg-gray-300"
                }`}>
                <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        checked ? "translate-x-6" : "translate-x-1"
                    }`}
                />
            </button>
        </div>
    );
}

export const editorIcons = {
    text: (props) => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}>
            <path d="M4 18V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V18" />
            <path d="M7 9h10M7 13h10M7 17h6" />
        </svg>
    ),
    droplet: (props) => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}>
            <path d="M12 3.5c2.4 3.6 6 6.8 6 10.3A6 6 0 1 1 6 13.8c0-3.5 3.6-6.7 6-10.3Z" />
        </svg>
    ),
    layers: (props) => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}>
            <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Zm-8 8.5 8 4.5 8-4.5M4 15.5l8 4.5 8-4.5" />
        </svg>
    ),
    ring: (props) => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}>
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    crosshair: (props) => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}>
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
    ),
};
export function ControlColorPicker({ label, value, onChange, options }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const [selectedGroup, setSelectedGroup] = useState("BambuLab");
    const [openUpward, setOpenUpward] = useState(false);
    const [alignRight, setAlignRight] = useState(false);

    const groupedOptions = useMemo(() => {
        const groups = {};
        options.forEach((opt) => {
            const g = opt.group || "Custom";
            if (!groups[g]) groups[g] = [];
            groups[g].push(opt);
        });
        return groups;
    }, [options]);

    useEffect(() => {
        if (
            !groupedOptions[selectedGroup] &&
            Object.keys(groupedOptions).length > 0
        ) {
            setSelectedGroup(Object.keys(groupedOptions)[0]);
        }
    }, [groupedOptions, selectedGroup]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOpen = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // If less than 380px below and space above, flip upward
            setOpenUpward(spaceBelow < 380 && rect.top > 250);
            // If button is in the right half of the container/sidebar, align right
            setAlignRight(rect.left > 130);
        }
        setIsOpen((prev) => !prev);
    };

    const selected =
        options.find((option) => option.value === value);

    return (
        <div className="space-y-1.5" ref={dropdownRef}>
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                {label}
            </span>

            <div className="relative">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={toggleOpen}
                    className={`flex w-full items-center justify-between rounded-xl border bg-gray-50 px-3 py-2.5 text-sm transition-all shadow-sm ${
                        isOpen
                            ? "border-[#14b8a6] bg-white ring-2 ring-[#14b8a6]/20"
                            : "border-gray-200 hover:border-gray-300"
                    }`}>
                    <div className="flex items-center gap-2 truncate">
                        <span
                            className="h-4 w-4 shrink-0 rounded-md border border-gray-200 shadow-sm"
                            style={{
                                backgroundColor:
                                    selected?.hex ||
                                    selected?.value ||
                                    value ||
                                    "#dfe7e7",
                                borderColor:
                                    selected?.hex ||
                                    selected?.value ||
                                    value ||
                                    "#dfe7e7",
                            }}
                        />
                        <span className="truncate font-medium text-gray-900">
                            {selected?.label || value || "Select"}
                        </span>
                    </div>

                    <div
                        className={`shrink-0 text-gray-400 transition-transform ${
                            isOpen ? "rotate-180 text-[#14b8a6]" : ""
                        }`}>
                        <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4">
                            <path d="M5.25 7.5 10 12.25 14.75 7.5H5.25Z" />
                        </svg>
                    </div>
                </button>

                {isOpen && (
                    <div
                        className={`absolute z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl p-3 w-[275px] max-w-[calc(100vw-32px)] ${
                            openUpward ? "bottom-full mb-2" : "top-full mt-2"
                        } ${alignRight ? "right-0" : "left-0"}`}>
                        <div className="flex gap-4 mb-3 border-b pb-2 border-gray-100 overflow-x-auto custom-scrollbar">
                            {Object.keys(groupedOptions).map((groupName) => (
                                <button
                                    key={groupName}
                                    type="button"
                                    onClick={() => setSelectedGroup(groupName)}
                                    className={`pb-1 text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap transition-colors ${
                                        selectedGroup === groupName
                                            ? "text-[#14b8a6] border-b-2 border-[#14b8a6]"
                                            : "text-gray-400 hover:text-gray-600"
                                    }`}>
                                    {groupName === "BambuLab"
                                        ? "Bambu Lab"
                                        : groupName}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {groupedOptions[selectedGroup]?.map((color) => {
                                const isSelected = value === color.value;
                                return (
                                    <div
                                        key={color.value + color.label}
                                        className="flex flex-col items-center overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onChange(color.value);
                                                setIsOpen(false);
                                            }}
                                            className={`aspect-square w-full rounded-md shadow-sm transition-transform hover:scale-110 ${
                                                isSelected
                                                    ? "ring-2 ring-[#14b8a6] ring-offset-1"
                                                    : "border border-black/10"
                                            }`}
                                            style={{
                                                backgroundColor:
                                                    color.hex || color.value,
                                            }}
                                            title={color.label}
                                        />
                                        <span
                                            className="mt-1 w-full truncate text-center text-[0.6rem] font-medium text-gray-500"
                                            title={color.label}>
                                            {color.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="mt-3 w-full text-xs text-white bg-gray-900 py-1.5 rounded-lg hover:bg-black transition-colors font-bold shadow-sm">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
