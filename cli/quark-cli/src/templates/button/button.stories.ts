export const buttonStoriesTemplate = `
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
    title: "Components/Button",
    component: Button,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
    argTypes: {
        label: {
            control: "text",
            description: "Button text label",
        },
        color: {
            control: "color",
            description: "Text color",
        },
        backgroundColor: {
            control: "color",
            description: "Background color",
        },
        disabled: {
            control: "boolean",
            description: "Disabled state",
        },
        onClick: {
            action: "clicked",
            description: "Click handler",
        },
    },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
    args: {
        label: "Button",
    },
};

export const Primary: Story = {
    args: {
        label: "Primary Button",
        backgroundColor: "#007bff",
        color: "#fff",
    },
};

export const Secondary: Story = {
    args: {
        label: "Secondary Button",
        backgroundColor: "#6c757d",
        color: "#fff",
    },
};

export const Success: Story = {
    args: {
        label: "Success Button",
        backgroundColor: "#28a745",
        color: "#fff",
    },
};

export const Danger: Story = {
    args: {
        label: "Danger Button",
        backgroundColor: "#dc3545",
        color: "#fff",
    },
};

export const Warning: Story = {
    args: {
        label: "Warning Button",
        backgroundColor: "#ffc107",
        color: "#000",
    },
};

export const Info: Story = {
    args: {
        label: "Info Button",
        backgroundColor: "#17a2b8",
        color: "#fff",
    },
};

export const Disabled: Story = {
    args: {
        label: "Disabled Button",
        disabled: true,
    },
};

export const Large: Story = {
    args: {
        label: "Large Button",
        style: {
            padding: "12px 24px",
            fontSize: "1.25rem",
        },
    },
};

export const Small: Story = {
    args: {
        label: "Small Button",
        style: {
            padding: "4px 8px",
            fontSize: "0.875rem",
        },
    },
};

export const CustomStyle: Story = {
    args: {
        label: "Custom Styled Button",
        backgroundColor: "#8b5cf6",
        color: "#fff",
        style: {
            borderRadius: "20px",
            padding: "10px 30px",
            fontSize: "1.1rem",
            fontWeight: "bold",
            textTransform: "uppercase",
        },
    },
};

export const WithEmoji: Story = {
    args: {
        label: "🚀 Launch",
        backgroundColor: "#10b981",
        color: "#fff",
    },
};
`

