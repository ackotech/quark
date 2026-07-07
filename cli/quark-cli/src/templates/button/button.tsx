export const buttonTemplate = `
import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: string;
    color?: string;
    backgroundColor?: string;
    style?: React.CSSProperties;
    rest?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            label = "Button",
            color = "#fff",
            backgroundColor = "#007bff",
            style,
            ...rest
        }: ButtonProps,
        ref: React.Ref<HTMLButtonElement>
    ) => {
        const combinedStyle: React.CSSProperties = {
            color,
            backgroundColor,
            border: "none",
            borderRadius: "4px",
            padding: "8px 16px",
            cursor: rest.disabled ? "not-allowed" : "pointer",
            opacity: rest.disabled ? 0.6 : 1,
            fontSize: "1rem",
            transition: "background 0.2s",
            ...style,
        };

        return (
            <button ref={ref} style={combinedStyle} {...rest}>
                {label}
            </button>
        );
    }
);

Button.displayName = "Button";
`

