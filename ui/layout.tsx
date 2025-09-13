export const metadata = {
	title: 'Task Manager',
	description: 'Simple tasks UI'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body style={{ margin: 0 }}>{children}</body>
		</html>
	);
}

