'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

type Task = {
	id?: number;
	_id?: string;
	title: string;
	description?: string;
	completed?: boolean;
	status?: 'pending' | 'in-progress' | 'completed';
};

const STATUSES = ['pending', 'in-progress', 'completed'] as const;

type StatusWord = typeof STATUSES[number];

export default function HomePage() {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [status, setStatus] = useState<Task['status']>('pending');

	const [query, setQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('');

	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const idOf = (t: Task) => t._id || t.id?.toString() || '';

	const fetchTasks = async () => {
		try {
			setLoading(true);
			setError(null);
			const params = new URLSearchParams();
			const trimmed = query.trim().toLowerCase();
			const qIsStatus: boolean = (STATUSES as readonly string[]).includes(trimmed);
			const effectiveStatus = statusFilter || (qIsStatus ? (trimmed as StatusWord) : '');
			if (effectiveStatus) params.set('status', effectiveStatus);
			if (!qIsStatus && query) params.set('q', query);
			const res = await fetch(`${API}/tasks${params.toString() ? `?${params.toString()}` : ''}`);
			const data = await res.json();
			setTasks(data);
		} catch (e) {
			setError('Failed to load tasks');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchTasks();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Debounced search on query change
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			if (query.trim() || statusFilter) fetchTasks();
		}, 300);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query]);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setLoading(true);
			setError(null);
			const creatingStatus = status;
			const res = await fetch(`${API}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, description, status: creatingStatus })
			});
			if (!res.ok) throw new Error('Create failed');
			setTitle('');
			setDescription('');
			setStatus('pending');
			// Focus the list on the created status and clear keyword to ensure visibility
			setStatusFilter(creatingStatus);
			setQuery('');
			await fetchTasks();
		} catch (e) {
			setError('Failed to create task');
		} finally {
			setLoading(false);
		}
	};

	const handleToggle = async (t: Task) => {
		const id = idOf(t);
		if (!id) return;
		const nextCompleted = !t.completed;
		const nextStatus: Task['status'] = nextCompleted ? 'completed' : 'pending';
		await fetch(`${API}/tasks/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ completed: nextCompleted, status: nextStatus })
		});
		await fetchTasks();
	};

	const handleDelete = async (t: Task) => {
		const id = idOf(t);
		if (!id) return;
		await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
		await fetchTasks();
	};

	// Client-side enforce status filter when applicable
	const visibleTasks = useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		const qIsStatus: boolean = (STATUSES as readonly string[]).includes(trimmed);
		const effectiveStatus = (statusFilter || (qIsStatus ? trimmed : '')) as StatusWord | '';

		const getStatus = (t: Task): StatusWord => (t.status ?? (t.completed ? 'completed' : 'pending')) as StatusWord;

		let base = tasks;
		if (effectiveStatus) {
			base = base.filter((t) => getStatus(t) === effectiveStatus);
		}

		if (!effectiveStatus && trimmed) {
			// exact title match only when not treating query as a status
			base = base.filter((t) => t.title?.toLowerCase() === trimmed);
		}

		return base;
	}, [tasks, query, statusFilter]);

	return (
		<div style={{ maxWidth: 720, margin: '24px auto', fontFamily: 'system-ui, sans-serif' }}>
			<h1>Task Manager</h1>

			<form onSubmit={handleCreate} style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
				<input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
				<textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
				<select value={status} onChange={(e) => setStatus(e.target.value as Task['status'])}>
					<option value="pending">pending</option>
					<option value="in-progress">in-progress</option>
					<option value="completed">completed</option>
				</select>
				<button type="submit" disabled={loading || !title.trim()}>Create Task</button>
			</form>

			<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
				<input
					placeholder="Search (title or status: pending/in-progress/completed)"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
				<select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); if (e.target.value || query.trim()) fetchTasks(); }}>
					<option value="">all</option>
					<option value="pending">pending</option>
					<option value="in-progress">in-progress</option>
					<option value="completed">completed</option>
				</select>
				<button type="button" onClick={() => { if (query.trim() || statusFilter) fetchTasks(); }} disabled={loading}>Search</button>
			</div>

			{(query.trim() || statusFilter) && visibleTasks.length === 0 && !loading ? (
				<div>No results</div>
			) : null}

			<ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
				{visibleTasks.map((t) => (
					<li key={idOf(t)} style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
							<div>
								<strong>{t.title}</strong>
								<div style={{ color: '#555', fontSize: 14 }}>{t.description}</div>
								<div style={{ fontSize: 12, color: '#666' }}>status: {t.status ?? (t.completed ? 'completed' : 'pending')}</div>
							</div>
							<div style={{ display: 'flex', gap: 8 }}>
								<button onClick={() => handleToggle(t)}>
									{t.completed ? 'Mark Pending' : 'Mark Completed'}
								</button>
								<button onClick={() => handleDelete(t)} style={{ color: '#b00020' }}>Delete</button>
							</div>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
