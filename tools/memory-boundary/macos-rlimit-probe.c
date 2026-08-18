#include <errno.h>
#include <inttypes.h>
#include <mach/mach.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <unistd.h>

#define MIB ((uint64_t)1024 * (uint64_t)1024)

#define LIMIT_HEADROOM_BYTES ((uint64_t)64 * MIB)
#define UNDER_LIMIT_ALLOCATION_BYTES ((size_t)16 * (size_t)MIB)
#define OVER_LIMIT_ALLOCATION_BYTES ((size_t)96 * (size_t)MIB)

typedef struct TaskMemorySnapshot
{
	uint64_t virtual_bytes;
	uint64_t resident_bytes;
} TaskMemorySnapshot;

static bool add_uint64(
	uint64_t left,
	uint64_t right,
	uint64_t *result)
{
	if (UINT64_MAX - left < right)
	{
		return false;
	}

	*result = left + right;

	return true;
}

static bool get_task_memory_snapshot(
	TaskMemorySnapshot *snapshot)
{
	mach_task_basic_info_data_t info;
	mach_msg_type_number_t count =
		MACH_TASK_BASIC_INFO_COUNT;

	const kern_return_t result = task_info(
		mach_task_self(),
		MACH_TASK_BASIC_INFO,
		(task_info_t)&info,
		&count);

	if (result != KERN_SUCCESS)
	{
		return false;
	}

	snapshot->virtual_bytes =
		(uint64_t)info.virtual_size;

	snapshot->resident_bytes =
		(uint64_t)info.resident_size;

	return true;
}

static bool touch_mapping(
	void *mapping,
	size_t allocation_bytes)
{
	const long page_size_result =
		sysconf(_SC_PAGESIZE);

	if (page_size_result <= 0)
	{
		return false;
	}

	const size_t page_size =
		(size_t)page_size_result;

	volatile unsigned char *memory =
		(volatile unsigned char *)mapping;

	for (
		size_t offset = 0;
		offset < allocation_bytes;
		offset += page_size)
	{
		memory[offset] =
			(unsigned char)(offset / page_size);
	}

	return true;
}

static void *allocate_and_touch(
	size_t allocation_bytes,
	int *captured_errno)
{
	errno = 0;

	void *mapping = mmap(
		NULL,
		allocation_bytes,
		PROT_READ | PROT_WRITE,
		MAP_PRIVATE | MAP_ANON,
		-1,
		0);

	if (mapping == MAP_FAILED)
	{
		*captured_errno = errno;

		return MAP_FAILED;
	}

	if (!touch_mapping(mapping, allocation_bytes))
	{
		*captured_errno = EIO;

		(void)munmap(
			mapping,
			allocation_bytes);

		return MAP_FAILED;
	}

	*captured_errno = 0;

	return mapping;
}

int main(void)
{
#ifndef RLIMIT_AS
	printf(
		"AFILA_MACOS_AS_PROBE "
		"{\"available\":false}\n");

	return 2;
#else
	const bool rss_is_as =
		RLIMIT_RSS == RLIMIT_AS;

	TaskMemorySnapshot baseline;

	if (!get_task_memory_snapshot(&baseline))
	{
		fprintf(
			stderr,
			"Could not read the initial task memory snapshot.\n");

		return 3;
	}

	uint64_t requested_limit_bytes;

	if (
		!add_uint64(
			baseline.virtual_bytes,
			LIMIT_HEADROOM_BYTES,
			&requested_limit_bytes))
	{
		fprintf(
			stderr,
			"The requested address-space limit overflowed.\n");

		return 4;
	}

	if (
		requested_limit_bytes >
		(uint64_t)RLIM_INFINITY)
	{
		fprintf(
			stderr,
			"The requested address-space limit does not fit rlim_t.\n");

		return 4;
	}

	struct rlimit previous_limit;

	if (
		getrlimit(
			RLIMIT_AS,
			&previous_limit) != 0)
	{
		perror("getrlimit");

		return 5;
	}

	const struct rlimit requested_limit = {
		.rlim_cur =
			(rlim_t)requested_limit_bytes,

		.rlim_max =
			(rlim_t)requested_limit_bytes};

	if (
		setrlimit(
			RLIMIT_AS,
			&requested_limit) != 0)
	{
		const int captured_errno = errno;

		printf(
			"AFILA_MACOS_AS_PROBE "
			"{"
			"\"available\":true,"
			"\"rssIsAs\":%s,"
			"\"stage\":\"setrlimit\","
			"\"baselineVirtualBytes\":%" PRIu64 ","
			"\"baselineResidentBytes\":%" PRIu64 ","
			"\"requestedLimitBytes\":%" PRIu64 ","
			"\"previousSoftLimit\":%" PRIu64 ","
			"\"previousHardLimit\":%" PRIu64 ","
			"\"completed\":false,"
			"\"errno\":%d,"
			"\"message\":\"%s\""
			"}\n",
			rss_is_as ? "true" : "false",
			baseline.virtual_bytes,
			baseline.resident_bytes,
			requested_limit_bytes,
			(uint64_t)previous_limit.rlim_cur,
			(uint64_t)previous_limit.rlim_max,
			captured_errno,
			strerror(captured_errno));

		return 6;
	}

	int under_limit_errno = 0;

	void *under_limit_mapping =
		allocate_and_touch(
			UNDER_LIMIT_ALLOCATION_BYTES,
			&under_limit_errno);

	const bool under_limit_succeeded =
		under_limit_mapping != MAP_FAILED;

	int over_limit_errno = 0;

	void *over_limit_mapping =
		allocate_and_touch(
			OVER_LIMIT_ALLOCATION_BYTES,
			&over_limit_errno);

	const bool over_limit_succeeded =
		over_limit_mapping != MAP_FAILED;

	TaskMemorySnapshot final_snapshot;

	if (!get_task_memory_snapshot(&final_snapshot))
	{
		fprintf(
			stderr,
			"Could not read the final task memory snapshot.\n");

		if (under_limit_succeeded)
		{
			(void)munmap(
				under_limit_mapping,
				UNDER_LIMIT_ALLOCATION_BYTES);
		}

		if (over_limit_succeeded)
		{
			(void)munmap(
				over_limit_mapping,
				OVER_LIMIT_ALLOCATION_BYTES);
		}

		return 7;
	}

	printf(
		"AFILA_MACOS_AS_PROBE "
		"{"
		"\"available\":true,"
		"\"rssIsAs\":%s,"
		"\"stage\":\"completed\","
		"\"baselineVirtualBytes\":%" PRIu64 ","
		"\"baselineResidentBytes\":%" PRIu64 ","
		"\"headroomBytes\":%" PRIu64 ","
		"\"requestedLimitBytes\":%" PRIu64 ","
		"\"underLimitAllocationBytes\":%zu,"
		"\"underLimitSucceeded\":%s,"
		"\"underLimitErrno\":%d,"
		"\"overLimitAllocationBytes\":%zu,"
		"\"overLimitSucceeded\":%s,"
		"\"overLimitErrno\":%d,"
		"\"overLimitMessage\":\"%s\","
		"\"finalVirtualBytes\":%" PRIu64 ","
		"\"finalResidentBytes\":%" PRIu64
		"}\n",
		rss_is_as ? "true" : "false",
		baseline.virtual_bytes,
		baseline.resident_bytes,
		LIMIT_HEADROOM_BYTES,
		requested_limit_bytes,
		UNDER_LIMIT_ALLOCATION_BYTES,
		under_limit_succeeded ? "true" : "false",
		under_limit_errno,
		OVER_LIMIT_ALLOCATION_BYTES,
		over_limit_succeeded ? "true" : "false",
		over_limit_errno,
		over_limit_errno == 0
			? ""
			: strerror(over_limit_errno),
		final_snapshot.virtual_bytes,
		final_snapshot.resident_bytes);

	if (under_limit_succeeded)
	{
		if (
			munmap(
				under_limit_mapping,
				UNDER_LIMIT_ALLOCATION_BYTES) != 0)
		{
			perror("munmap under-limit mapping");

			return 8;
		}
	}

	if (over_limit_succeeded)
	{
		if (
			munmap(
				over_limit_mapping,
				OVER_LIMIT_ALLOCATION_BYTES) != 0)
		{
			perror("munmap over-limit mapping");

			return 8;
		}
	}

	if (!under_limit_succeeded)
	{
		return 9;
	}

	if (over_limit_succeeded)
	{
		return 10;
	}

	if (over_limit_errno != ENOMEM)
	{
		return 11;
	}

	return 0;
#endif
}
