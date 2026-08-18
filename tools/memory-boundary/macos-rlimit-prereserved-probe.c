#include <errno.h>
#include <inttypes.h>
#include <mach/mach.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <unistd.h>

#define MIB ((uint64_t)1024 * (uint64_t)1024)

#define EXISTING_RESERVATION_BYTES \
	((size_t)192 * (size_t)MIB)

#define EXISTING_TOUCH_BYTES \
	((size_t)128 * (size_t)MIB)

#define LIMIT_HEADROOM_BYTES \
	((uint64_t)64 * MIB)

#define NEW_ALLOCATION_BYTES \
	((size_t)96 * (size_t)MIB)

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

	const kern_return_t result =
		task_info(
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

static bool touch_existing_mapping(
	void *mapping,
	size_t bytes_to_touch)
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
		offset < bytes_to_touch;
		offset += page_size)
	{
		memory[offset] =
			(unsigned char)((offset / page_size) ^
							(offset >> 16));
	}

	return true;
}

int main(void)
{
#ifndef RLIMIT_AS
	printf(
		"AFILA_MACOS_PRERESERVED_PROBE "
		"{\"available\":false}\n");

	return 2;
#else
	TaskMemorySnapshot baseline;

	if (!get_task_memory_snapshot(&baseline))
	{
		fprintf(
			stderr,
			"Could not read the baseline memory snapshot.\n");

		return 3;
	}

	/*
	 * Reserve the address space before applying
	 * RLIMIT_AS, but do not touch its pages yet.
	 */
	void *existing_mapping =
		mmap(
			NULL,
			EXISTING_RESERVATION_BYTES,
			PROT_READ | PROT_WRITE,
			MAP_PRIVATE | MAP_ANON,
			-1,
			0);

	if (existing_mapping == MAP_FAILED)
	{
		perror("initial mmap");

		return 4;
	}

	TaskMemorySnapshot after_reservation;

	if (
		!get_task_memory_snapshot(
			&after_reservation))
	{
		fprintf(
			stderr,
			"Could not read the post-reservation snapshot.\n");

		(void)munmap(
			existing_mapping,
			EXISTING_RESERVATION_BYTES);

		return 5;
	}

	uint64_t requested_limit_bytes;

	if (
		!add_uint64(
			after_reservation.virtual_bytes,
			LIMIT_HEADROOM_BYTES,
			&requested_limit_bytes))
	{
		fprintf(
			stderr,
			"The requested address-space limit overflowed.\n");

		(void)munmap(
			existing_mapping,
			EXISTING_RESERVATION_BYTES);

		return 6;
	}

	if (
		requested_limit_bytes >
		(uint64_t)RLIM_INFINITY)
	{
		fprintf(
			stderr,
			"The requested limit does not fit rlim_t.\n");

		(void)munmap(
			existing_mapping,
			EXISTING_RESERVATION_BYTES);

		return 6;
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
			"AFILA_MACOS_PRERESERVED_PROBE "
			"{"
			"\"stage\":\"setrlimit\","
			"\"completed\":false,"
			"\"baselineVirtualBytes\":%" PRIu64 ","
			"\"reservedVirtualBytes\":%" PRIu64 ","
			"\"requestedLimitBytes\":%" PRIu64 ","
			"\"errno\":%d,"
			"\"message\":\"%s\""
			"}\n",
			baseline.virtual_bytes,
			after_reservation.virtual_bytes,
			requested_limit_bytes,
			captured_errno,
			strerror(captured_errno));

		(void)munmap(
			existing_mapping,
			EXISTING_RESERVATION_BYTES);

		return 7;
	}

	/*
	 * Make 128 MiB resident inside the mapping that
	 * existed before RLIMIT_AS was installed.
	 */
	if (
		!touch_existing_mapping(
			existing_mapping,
			EXISTING_TOUCH_BYTES))
	{
		fprintf(
			stderr,
			"Could not touch the existing mapping.\n");

		(void)munmap(
			existing_mapping,
			EXISTING_RESERVATION_BYTES);

		return 8;
	}

	TaskMemorySnapshot after_touch;

	if (
		!get_task_memory_snapshot(
			&after_touch))
	{
		fprintf(
			stderr,
			"Could not read the post-touch snapshot.\n");

		(void)munmap(
			existing_mapping,
			EXISTING_RESERVATION_BYTES);

		return 9;
	}

	errno = 0;

	void *new_mapping =
		mmap(
			NULL,
			NEW_ALLOCATION_BYTES,
			PROT_READ | PROT_WRITE,
			MAP_PRIVATE | MAP_ANON,
			-1,
			0);

	const bool new_mapping_succeeded =
		new_mapping != MAP_FAILED;

	const int new_mapping_errno =
		new_mapping_succeeded
			? 0
			: errno;

	const uint64_t resident_growth_bytes =
		after_touch.resident_bytes >
				after_reservation.resident_bytes
			? after_touch.resident_bytes -
				  after_reservation.resident_bytes
			: 0;

	printf(
		"AFILA_MACOS_PRERESERVED_PROBE "
		"{"
		"\"stage\":\"completed\","
		"\"baselineVirtualBytes\":%" PRIu64 ","
		"\"baselineResidentBytes\":%" PRIu64 ","
		"\"existingReservationBytes\":%zu,"
		"\"existingTouchBytes\":%zu,"
		"\"virtualBytesAfterReservation\":%" PRIu64 ","
		"\"residentBytesAfterReservation\":%" PRIu64 ","
		"\"limitHeadroomBytes\":%" PRIu64 ","
		"\"requestedLimitBytes\":%" PRIu64 ","
		"\"virtualBytesAfterTouch\":%" PRIu64 ","
		"\"residentBytesAfterTouch\":%" PRIu64 ","
		"\"residentGrowthBytes\":%" PRIu64 ","
		"\"newAllocationBytes\":%zu,"
		"\"newAllocationSucceeded\":%s,"
		"\"newAllocationErrno\":%d,"
		"\"newAllocationMessage\":\"%s\""
		"}\n",
		baseline.virtual_bytes,
		baseline.resident_bytes,
		EXISTING_RESERVATION_BYTES,
		EXISTING_TOUCH_BYTES,
		after_reservation.virtual_bytes,
		after_reservation.resident_bytes,
		LIMIT_HEADROOM_BYTES,
		requested_limit_bytes,
		after_touch.virtual_bytes,
		after_touch.resident_bytes,
		resident_growth_bytes,
		NEW_ALLOCATION_BYTES,
		new_mapping_succeeded
			? "true"
			: "false",
		new_mapping_errno,
		new_mapping_errno == 0
			? ""
			: strerror(new_mapping_errno));

	if (new_mapping_succeeded)
	{
		(void)munmap(
			new_mapping,
			NEW_ALLOCATION_BYTES);
	}

	if (
		munmap(
			existing_mapping,
			EXISTING_RESERVATION_BYTES) != 0)
	{
		perror("munmap existing mapping");

		return 10;
	}

	if (new_mapping_succeeded)
	{
		return 11;
	}

	if (new_mapping_errno != ENOMEM)
	{
		return 12;
	}

	/*
	 * The experiment is conclusive only if resident
	 * memory grew beyond the allowed virtual-space
	 * headroom using the pre-existing mapping.
	 */
	if (
		resident_growth_bytes <=
		LIMIT_HEADROOM_BYTES)
	{
		return 13;
	}

	return 0;
#endif
}
